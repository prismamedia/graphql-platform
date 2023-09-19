import * as core from '@prismamedia/graphql-platform';
import assert from 'node:assert/strict';
import { escapeIdentifier } from '../../../escaping.js';
import type { Column, Table } from '../../../schema.js';
import { orderNode } from './ordering-expression.js';
import { JoinTable, TableFactor } from './table-reference.js';
import { filterNode } from './where-condition.js';

export abstract class AbstractTableReference {
  public abstract readonly alias: string;

  /**
   * The depth of a node is the number of edges from the node to the tree's root node.
   * A root node will have a depth of 0.
   */
  public abstract readonly depth: number;

  public readonly joinsByAlias = new Map<JoinTable['alias'], JoinTable>();
  public readonly subqueries = new Set<TableFactor>();

  public constructor(
    public readonly table: Table,
    public readonly context: core.OperationContext,
  ) {}

  public abstract toString(): string;

  /**
   * The height of a node is the number of edges on the longest path from the node to a leaf.
   * A leaf node will have a height of 0.
   */
  public get height(): number {
    return this.subqueries.size || this.joinsByAlias.size
      ? Math.max(
          ...Array.from(this.subqueries, (child) => child.height),
          ...Array.from(this.joinsByAlias.values(), (child) => child.height),
        ) + 1
      : 0;
  }

  public join(edge: core.Edge | core.UniqueReverseEdge): JoinTable {
    assert(edge instanceof core.Edge || edge instanceof core.UniqueReverseEdge);
    assert.equal(edge.tail, this.table.node);

    const joinTable = new JoinTable(this, edge);

    const maybeExistingJoinTable = this.joinsByAlias.get(joinTable.alias);

    // We join a table only once
    if (maybeExistingJoinTable) {
      return maybeExistingJoinTable;
    }

    this.joinsByAlias.set(joinTable.alias, joinTable);

    return joinTable;
  }

  /**
   * @see https://mariadb.com/kb/en/subqueries/
   */
  public subquery(
    selectExpressions: string | ((tableReference: TableFactor) => string),
    reverseEdge: core.MultipleReverseEdge,
    headFilter?: core.NodeFilter,
    headOrdering?: core.NodeOrdering,
    limit?: number | null,
    offset?: number | null,
  ): string {
    assert(reverseEdge instanceof core.MultipleReverseEdge);
    assert.equal(reverseEdge.tail, this.table.node);

    const tail = this.table.schema.getTableByNode(reverseEdge.tail);
    const head = this.table.schema.getTableByNode(reverseEdge.head);
    const headAuthorization = this.context.getAuthorization(reverseEdge.head);

    const tableReference = new TableFactor(
      head,
      this.context,
      `${tail.name}>${reverseEdge.name}`,
    );

    this.subqueries.add(tableReference);

    const whereCondition = [
      ...head
        .getForeignKeyByEdge(reverseEdge.originalEdge)
        .columns.map(
          (column) =>
            `${this.getEscapedColumnIdentifier(
              column.referencedColumn,
            )} <=> ${tableReference.getEscapedColumnIdentifier(column)}`,
        ),
      headAuthorization
        ? filterNode(tableReference, headAuthorization)
        : undefined,
      headFilter ? filterNode(tableReference, headFilter) : undefined,
    ]
      .filter(Boolean)
      .join(' AND ');

    const orderingExpressions = headOrdering
      ? orderNode(tableReference, headOrdering)
      : undefined;

    return [
      `SELECT ${
        typeof selectExpressions === 'function'
          ? selectExpressions(tableReference)
          : selectExpressions
      }`,
      `FROM ${tableReference}`,
      `WHERE ${whereCondition}`,
      orderingExpressions && `ORDER BY ${orderingExpressions}`,
      limit != null && `LIMIT ${limit}`,
      offset && `OFFSET ${offset}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  public getEscapedColumnIdentifier(column: Column): string {
    assert(this.table.columns.includes(column));

    return escapeIdentifier(`${this.alias}.${column.name}`);
  }

  public getEscapedColumnIdentifierByLeaf(leaf: core.Leaf): string {
    return this.getEscapedColumnIdentifier(this.table.getColumnByLeaf(leaf));
  }
}
