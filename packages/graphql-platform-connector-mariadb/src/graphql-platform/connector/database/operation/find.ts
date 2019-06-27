import {
  ConnectorFindOperationArgs,
  ConnectorFindOperationResult,
  NodeFieldKind,
  NodeSource,
} from '@prismamedia/graphql-platform-core';
import { GraphQLSelectionNode, isPlainObject, mergeWith, POJO } from '@prismamedia/graphql-platform-utils';
import { AbstractOperationResolver } from '../abstract-operation';
import { OperationResolverParams } from '../operation';
import { Column } from '../table/column';
import { ColumnReference } from '../table/column-reference';
import { SelectExpressionSet, SelectStatement } from '../table/statement';
import { OrderByExpressionSet } from '../table/statement/order-by';
import { TableReference } from '../table/statement/reference';
import { WhereConditionBool } from '../table/statement/where';

export class FindOperation extends AbstractOperationResolver<ConnectorFindOperationArgs, ConnectorFindOperationResult> {
  public preferForeignKeyColumn(column: ColumnReference, relatedNodeSelection: GraphQLSelectionNode): boolean {
    const referencedColumn = column.reference;
    const referencedComponent = referencedColumn.component;

    for (const selection of relatedNodeSelection.values()) {
      if (referencedComponent.name === selection.name) {
        if (referencedColumn instanceof Column) {
          relatedNodeSelection.delete(selection.key);

          return true;
        } else {
          return this.preferForeignKeyColumn(referencedColumn, selection);
        }
      }
    }

    return false;
  }

  public async parseSelectionNode(select: SelectExpressionSet, selectionNode: GraphQLSelectionNode) {
    for (const selection of selectionNode.values()) {
      const nodeField = this.resource.getOutputType('Node').assertField(selection);
      switch (nodeField.kind) {
        case NodeFieldKind.Field: {
          const field = nodeField.field;

          const column = this.table.getColumn(field);
          select.add(column);
          break;
        }

        case NodeFieldKind.Relation: {
          const relation = nodeField.relation;

          const foreignKey = this.table.getForeignKey(relation);

          // We'll try to fetch the related table's columns in the current table's foreign key to avoid a costly join
          // As we will modify the selection, we create a carbon copy of it
          const selectionCopy = selection.clone();

          // Columns of the foreign key that have been selected
          const selectedForeignKeyColumnSet = foreignKey
            .getColumnSet()
            .filter(column => this.preferForeignKeyColumn(column, selectionCopy));

          select.push(...selectedForeignKeyColumnSet);

          if (selectionCopy.size > 0) {
            const relatedTable = this.database.getTable(relation.getTo());
            const relatedFindOperation = relatedTable.getOperation('Find');

            select.on(relation, select => relatedFindOperation.parseSelectionNode(select, selectionCopy));
          }

          // This non-nullable reference's value will tell us if the relation is defined or not
          if (relation.isNullable() && selectedForeignKeyColumnSet.every(column => column.reference.nullable)) {
            select.push(foreignKey.getFirstNonNullableReference());
          }
          break;
        }

        case NodeFieldKind.InverseRelation: {
          const inverseRelation = nodeField.inverseRelation;

          if (inverseRelation.isToOne()) {
            const relatedTable = this.database.getTable(inverseRelation.getTo());
            const relatedFindOperation = relatedTable.getOperation('Find');

            select.on(inverseRelation, select => {
              relatedFindOperation.parseSelectionNode(select, selection);

              // This non-nullable column's value will tell us if the relation is defined or not
              const firstNonNullableColumn = relatedTable
                .getPrimaryKey()
                .getColumnSet()
                .assertFirst();

              select.push(firstNonNullableColumn);
            });
          } else {
            // Add the columns needed to request the inverse relation later
            this.database
              .getTable(inverseRelation.getTo())
              .getForeignKey(inverseRelation.getInverse())
              .getColumnSet()
              .forEach(({ reference }) => select.add(reference));
          }
          break;
        }

        case NodeFieldKind.InverseRelationCount: {
          const inverseRelation = nodeField.inverseRelation;

          // Add the columns needed to request the inverse relation later
          this.database
            .getTable(inverseRelation.getTo())
            .getForeignKey(inverseRelation.getInverse())
            .getColumnSet()
            .forEach(({ reference }) => select.add(reference));
          break;
        }

        case NodeFieldKind.VirtualField: {
          const virtualField = nodeField.virtualField;

          virtualField.dependencySet.forEach(component => select.add(this.table.getComponentColumnSet(component)));
          break;
        }
      }
    }
  }

  public async parseWhereArg(where: WhereConditionBool, whereArg: ConnectorFindOperationArgs['where']) {
    await this.resource.getInputType('Where').parse(
      {
        parseFieldFilter: (field, filterId, value) => {
          const column = this.table.getColumn(field);

          switch (filterId) {
            case 'eq':
              value === null ? where.addFilter(column, 'IS NULL') : where.addFilter(column, '=', value);
              break;

            case 'not':
              value === null ? where.addFilter(column, 'IS NOT NULL') : where.addFilter(column, '<>', value);
              break;

            case 'in':
              Array.isArray(value) && where.addFilter(column, 'IN', value);
              break;

            case 'not_in':
              Array.isArray(value) && where.addFilter(column, 'NOT IN', value);
              break;

            case 'contains':
              value !== null && where.addFilter(column, 'LIKE', `%${value}%`);
              break;

            case 'not_contains':
              value !== null && where.addFilter(column, 'NOT LIKE', `%${value}%`);
              break;

            case 'starts_with':
              value !== null && where.addFilter(column, 'LIKE', `${value}%`);
              break;

            case 'not_starts_with':
              value !== null && where.addFilter(column, 'NOT LIKE', `${value}%`);
              break;

            case 'ends_with':
              value !== null && where.addFilter(column, 'LIKE', `%${value}`);
              break;

            case 'not_ends_with':
              value !== null && where.addFilter(column, 'NOT LIKE', `%${value}`);
              break;

            case 'lt':
              value !== null && where.addFilter(column, '<', value);
              break;

            case 'lte':
              value !== null && where.addFilter(column, '<=', value);
              break;

            case 'gt':
              value !== null && where.addFilter(column, '>', value);
              break;

            case 'gte':
              value !== null && where.addFilter(column, '>=', value);
              break;

            default:
              throw new Error(`The field filter "${filterId}" is not implemented, yet`);
          }
        },
        parseRelationFilter: (relation, filterId, value) => {
          const foreignKey = this.table.getForeignKey(relation);
          const foreignKeyColumnSet = foreignKey.getColumnSet();
          const firstNonNullableForeignKeyColumn = foreignKey.getNonNullableReferenceSet().first();

          const relatedTable = this.database.getTable(relation.getTo());
          const relatedTablePrimaryKey = relatedTable.getPrimaryKey();
          const firstRelatedTablePrimaryKeyColumn = relatedTablePrimaryKey.getColumnSet().assertFirst();

          switch (filterId) {
            case 'eq':
              if (value === null) {
                if (firstNonNullableForeignKeyColumn) {
                  where.addFilter(firstNonNullableForeignKeyColumn, 'IS NULL');
                } else {
                  where.on(relation, where => where.addFilter(firstRelatedTablePrimaryKeyColumn, 'IS NULL'));
                }
              } else {
                const relatedNodeId =
                  firstNonNullableForeignKeyColumn &&
                  relation
                    .getTo()
                    .getInputType('WhereUnique')
                    .parseUnique(value, relation.getToUnique(), true);

                if (relatedNodeId && Object.keys(relatedNodeId).length === Object.keys(value).length) {
                  where.addAnd(where =>
                    foreignKeyColumnSet.forEach(column => {
                      const fieldValue = column.reference.assertValue(relatedNodeId);

                      fieldValue === null
                        ? where.addFilter(column, 'IS NULL')
                        : where.addFilter(column, '=', fieldValue);
                    }),
                  );
                } else {
                  where.on(relation, where => relatedTable.getOperation('Find').parseWhereArg(where, value));
                }
              }
              break;

            case 'is_null':
              if (typeof value === 'boolean') {
                if (firstNonNullableForeignKeyColumn) {
                  where.addFilter(firstNonNullableForeignKeyColumn, value ? 'IS NULL' : 'IS NOT NULL');
                } else {
                  where.on(relation, where =>
                    where.addFilter(firstRelatedTablePrimaryKeyColumn, value ? 'IS NULL' : 'IS NOT NULL'),
                  );
                }
              }
              break;

            default:
              throw new Error(`The relation filter "${filterId}" is not implemented, yet`);
          }
        },
        parseInverseRelationFilter: (inverseRelation, filterId, value) => {
          const findManyTo = this.database.getTable(inverseRelation.getTo()).getOperation('Find');

          switch (filterId) {
            case 'eq':
              where.on(inverseRelation, where => findManyTo.parseWhereArg(where, value));
              break;

            case 'is_null':
              if (typeof value === 'boolean') {
                const relatedTable = this.database.getTable(inverseRelation.getTo());
                const relatedTablePrimaryKey = relatedTable.getPrimaryKey();
                const firstRelatedTablePrimaryKeyColumn = relatedTablePrimaryKey.getColumnSet().assertFirst();

                where.on(inverseRelation, where =>
                  where.addFilter(firstRelatedTablePrimaryKeyColumn, value ? 'IS NULL' : 'IS NOT NULL'),
                );
              }
              break;

            case 'some':
              where.on(inverseRelation, where => findManyTo.parseWhereArg(where, value));
              break;

            default:
              throw new Error(`The relation filter "${filterId}" is not implemented, yet`);
          }
        },
        parseLogicalOperatorFilter: (filterId, value) => {
          switch (filterId) {
            case 'and':
              where.addAnd(and => Array.isArray(value) && value.forEach(subValue => this.parseWhereArg(and, subValue)));
              break;

            case 'or':
              where.addOr(or => Array.isArray(value) && value.forEach(subValue => this.parseWhereArg(or, subValue)));
              break;

            case 'not':
              where.addNotAnd(and => this.parseWhereArg(and, value));
              break;

            default:
              throw new Error(`The logical operator "${filterId}" is not implemented, yet`);
          }
        },
      },
      whereArg,
    );
  }

  public async parseOrderByArg(orderBy: OrderByExpressionSet, orderByArg: ConnectorFindOperationArgs['orderBy']) {
    await this.resource.getInputType('OrderBy').parse(
      {
        parseFieldFilter: (field, sortId) => {
          const column = this.table.getColumn(field);

          switch (sortId) {
            case 'asc':
              orderBy.addSort(column, 'ASC');
              break;

            case 'desc':
              orderBy.addSort(column, 'DESC');
              break;
          }
        },
      },
      orderByArg,
    );
  }

  public async parseSkipArg(selectStatement: SelectStatement, skip: ConnectorFindOperationArgs['skip']) {
    selectStatement.offset = typeof skip === 'number' && skip > 0 ? skip : 0;
  }

  public async parseFirstArg(selectStatement: SelectStatement, first: ConnectorFindOperationArgs['first']) {
    selectStatement.limit = first;
  }

  protected getRowTableData(data: POJO, tableReference: TableReference): POJO {
    return isPlainObject(data[tableReference.alias]) ? data[tableReference.alias] : {};
  }

  public parseRow(data: POJO, tableReference: TableReference, selectionNode: GraphQLSelectionNode): NodeSource {
    const table = tableReference.table;
    const resource = table.resource;
    const database = table.database;

    const node: NodeSource = Object.create(null);

    const tableData: POJO = this.getRowTableData(data, tableReference);

    for (const selection of selectionNode.values()) {
      const nodeField = resource.getOutputType('Node').assertField(selection);
      switch (nodeField.kind) {
        case NodeFieldKind.Field: {
          const field = nodeField.field;

          const column = table.getColumn(field);
          column.setValue(node, tableData[column.name]);
          break;
        }

        case NodeFieldKind.Relation: {
          const relation = nodeField.relation;

          const foreignKey = this.table.getForeignKey(relation);

          const selectionCopy = selection.clone();

          const selectedForeignKeyColumnSet = foreignKey
            .getColumnSet()
            .filter(column => this.preferForeignKeyColumn(column, selectionCopy));

          if (
            relation.isNullable() &&
            tableData[
              (
                selectedForeignKeyColumnSet.find(column => !column.reference.nullable) ||
                foreignKey.getFirstNonNullableReference()
              ).name
            ] === null
          ) {
            mergeWith(node, {
              [nodeField.name]: null,
            });
          } else {
            selectedForeignKeyColumnSet.forEach(column => column.setValue(node, tableData[column.name]));

            if (selectionCopy.size > 0) {
              const relatedTable = database.getTable(relation.getTo());
              const relatedFindOperation = relatedTable.getOperation('Find');

              mergeWith(node, {
                [nodeField.name]: relatedFindOperation.parseRow(data, tableReference.join(relation), selectionCopy),
              });
            }
          }

          break;
        }

        case NodeFieldKind.InverseRelation: {
          const inverseRelation = nodeField.inverseRelation;

          const relatedTable = this.database.getTable(inverseRelation.getTo());
          const relatedPrimaryKey = relatedTable.getPrimaryKey();
          const relatedForeignKey = relatedTable.getForeignKey(inverseRelation.getInverse());
          const relatedFindOperation = relatedTable.getOperation('Find');

          if (inverseRelation.isToOne()) {
            const relatedTableData = this.getRowTableData(data, tableReference.join(inverseRelation));
            const firstNonNullableColumn = relatedPrimaryKey.getColumnSet().assertFirst();

            mergeWith(node, {
              [nodeField.name]:
                relatedTableData[firstNonNullableColumn.name] !== null
                  ? relatedFindOperation.parseRow(data, tableReference.join(inverseRelation), selection)
                  : null,
            });
          } else {
            relatedForeignKey
              .getColumnSet()
              .forEach(({ reference }) => reference.setValue(node, tableData[reference.name]));

            node[nodeField.name] = async params =>
              relatedFindOperation.execute({
                ...params,
                args: {
                  ...params.args,
                  where: {
                    AND: [
                      {
                        [inverseRelation.getInverse().name]: resource
                          .getInputType('WhereUnique')
                          .assertUnique(node, inverseRelation.getInverse().getToUnique(), true),
                      },
                      params.args.where,
                    ],
                  },
                },
              });
          }
          break;
        }

        case NodeFieldKind.InverseRelationCount: {
          const inverseRelation = nodeField.inverseRelation;

          const relatedTable = database.getTable(inverseRelation.getTo());
          const relatedForeignKey = relatedTable.getForeignKey(inverseRelation.getInverse());
          const relatedCountOperation = relatedTable.getOperation('Count');

          relatedForeignKey
            .getColumnSet()
            .forEach(({ reference }) => reference.setValue(node, tableData[reference.name]));

          node[nodeField.name] = async params =>
            relatedCountOperation.execute({
              ...params,
              args: {
                ...params.args,
                where: {
                  AND: [
                    {
                      [inverseRelation.getInverse().name]: resource
                        .getInputType('WhereUnique')
                        .assertUnique(node, inverseRelation.getInverse().getToUnique(), true),
                    },
                    params.args.where,
                  ],
                },
              },
            });
          break;
        }

        case NodeFieldKind.VirtualField:
          const virtualField = nodeField.virtualField;

          table
            .getComponentSetColumnSet(virtualField.dependencySet)
            .forEach(column => column.setValue(node, tableData[column.name]));
          break;
      }
    }

    return node;
  }

  public async execute({ args, selectionNode, connection }: OperationResolverParams<ConnectorFindOperationArgs>) {
    const selectStatement = this.table.newSelectStatement();

    await Promise.all([
      this.parseSelectionNode(selectStatement.select, selectionNode),
      this.parseWhereArg(selectStatement.where, args.where),
      this.parseOrderByArg(selectStatement.orderBy, args.orderBy),
      this.parseSkipArg(selectStatement, args.skip),
      this.parseFirstArg(selectStatement, args.first),
    ]);

    if (selectStatement.from.isToMany()) {
      selectStatement.groupBy.add(this.table.getPrimaryKey().getColumnSet());
    }

    const rows = await this.connector.query(
      {
        nestTables: true,
        sql: selectStatement.sql,
      },
      connection,
    );

    return Array.isArray(rows) ? rows.map(row => this.parseRow(row, selectStatement.from, selectionNode)) : [];
  }
}
