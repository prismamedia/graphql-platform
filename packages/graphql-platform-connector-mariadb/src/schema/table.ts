import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { UnreachableValueError } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import type { MariaDBConnector } from '../index.js';
import type { Schema } from '../schema.js';
import {
  AddTableForeignKeysStatement,
  AddTableForeignKeysStatementConfig,
  CountStatement,
  CountStatementConfig,
  CreateTableStatement,
  CreateTableStatementConfig,
  FindStatement,
  FindStatementConfig,
  InsertStatement,
  InsertStatementConfig,
} from '../statement.js';
import { Column, LeafColumn, ReferenceColumnTree } from './table/column.js';
import { ForeignKey, PrimaryKey, UniqueIndex } from './table/index.js';

export * from './table/column.js';
export * from './table/data-type.js';
export * from './table/index.js';

export interface TableConfig {
  /**
   * Optional, the table's name
   *
   * Default: node's name plural in snake_cased
   */
  name?: utils.Nillable<string>;

  /**
   * Optional, the table's default charset
   *
   * Default: the schema's default charset
   */
  defaultCharset?: utils.Nillable<string>;

  /**
   * Optional, the table's default collation
   *
   * Default: the schema's default collation
   */
  defaultCollation?: utils.Nillable<string>;
}

export class Table {
  public readonly config: TableConfig | undefined;
  public readonly configPath: utils.Path;

  public readonly name: string;
  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  public readonly qualifiedName: string;
  public readonly engine: string;
  public readonly defaultCharset: string;
  public readonly defaultCollation: string;
  public readonly columnsByLeaf: ReadonlyMap<core.Leaf, LeafColumn>;
  public readonly primaryKey: PrimaryKey;
  public readonly uniqueIndexesByUniqueConstraint: ReadonlyMap<
    core.UniqueConstraint,
    UniqueIndex
  >;
  public readonly foreignKeysByEdge: ReadonlyMap<core.Edge, ForeignKey>;

  public constructor(
    public readonly schema: Schema,
    public readonly node: core.Node<any, MariaDBConnector>,
  ) {
    // config
    {
      this.config = node.config.table;
      this.configPath = utils.addPath(node.configPath, 'table');

      utils.assertNillablePlainObjectConfig(this.config, this.configPath);
    }

    // name
    {
      this.name = this.config?.name ?? inflection.tableize(node.name);
    }

    // qualified-name
    {
      this.qualifiedName = `${this.schema.name}.${this.name}`;
    }

    // engine
    {
      this.engine = 'InnoDB';
    }

    // default-charset
    {
      this.defaultCharset =
        this.config?.defaultCharset ?? schema.defaultCharset;
    }

    // default-collation
    {
      this.defaultCollation =
        this.config?.defaultCollation ?? schema.defaultCollation;
    }

    // columns-by-leaf
    {
      this.columnsByLeaf = new Map(
        Array.from(node.leavesByName.values(), (leaf) => [
          leaf,
          new LeafColumn(this, leaf),
        ]),
      );
    }

    // primary-key
    {
      this.primaryKey = new PrimaryKey(this, node.identifier);
    }

    // unique-indexes-by-unique-constraint
    {
      this.uniqueIndexesByUniqueConstraint = new Map(
        Array.from(node.uniqueConstraintsByName.values())
          .filter((uniqueConstraint) => !uniqueConstraint.isIdentifier())
          .map((uniqueConstraint) => [
            uniqueConstraint,
            new UniqueIndex(this, uniqueConstraint),
          ]),
      );
    }

    // foreign-keys-by-edge
    {
      this.foreignKeysByEdge = new Map(
        Array.from(node.edgesByName.values(), (edge) => [
          edge,
          new ForeignKey(this, edge),
        ]),
      );
    }
  }

  public toString(): string {
    return this.qualifiedName;
  }

  public getColumnByLeaf(leaf: core.Leaf): LeafColumn {
    const column = this.columnsByLeaf.get(leaf);
    assert(column, `The leaf "${leaf}" is not part of the node "${this.node}"`);

    return column;
  }

  @Memoize()
  public get columnTreesByEdge(): ReadonlyMap<core.Edge, ReferenceColumnTree> {
    return new Map(
      Array.from(this.node.edgesByName.values(), (edge) => [
        edge,
        new ReferenceColumnTree(this.schema, edge),
      ]),
    );
  }

  public getColumnTreeByEdge(edge: core.Edge): ReferenceColumnTree {
    const columnTree = this.columnTreesByEdge.get(edge);
    assert(
      columnTree,
      `The edge "${edge}" is not part of the node "${this.node}"`,
    );

    return columnTree;
  }

  public getColumnsByComponents(
    ...components: ReadonlyArray<core.Component>
  ): Array<Column> {
    return components.flatMap<Column>((component) =>
      component instanceof core.Leaf
        ? this.getColumnByLeaf(component)
        : this.getColumnTreeByEdge(component).columns,
    );
  }

  @Memoize()
  public get columns(): ReadonlyArray<Column> {
    return Object.freeze(
      this.getColumnsByComponents(...this.node.componentsByName.values()),
    );
  }

  public getUniqueIndexByUniqueConstraint(
    uniqueConstraint: core.UniqueConstraint,
  ): UniqueIndex {
    const uniqueIndex =
      this.uniqueIndexesByUniqueConstraint.get(uniqueConstraint);
    assert(
      uniqueIndex,
      `The unique-constraint "${uniqueConstraint}" is not part of the node "${this.node}"`,
    );

    return uniqueIndex;
  }

  public getForeignKeyByEdge(edge: core.Edge): ForeignKey {
    const foreignKey = this.foreignKeysByEdge.get(edge);
    assert(
      foreignKey,
      `The edge "${edge}" is not part of the node "${this.node}"`,
    );

    return foreignKey;
  }

  protected parseRow<TValue extends core.NodeValue>(
    row: utils.PlainObject,
  ): TValue {
    if (!utils.isPlainObject(row)) {
      throw new utils.UnexpectedValueError('a plain-object', row);
    }

    for (const column of this.columns) {
      if (typeof row[column.name] === 'undefined') {
        throw new utils.UnexpectedValueError(
          `the column "${column}"'s value to be defined`,
          row[column.name],
        );
      }
    }

    return Array.from(this.node.componentsByName.values()).reduce<TValue>(
      (nodeValue, component) =>
        Object.assign(nodeValue, {
          [component.name]: component.parseValue(
            component instanceof core.Leaf
              ? this.getColumnByLeaf(component).pickLeafValueFromRow(row)
              : this.getColumnTreeByEdge(component).pickEdgeValueFromRow(row),
          ),
        }),
      Object.create(null),
    );
  }

  public parseSelectedValue<TValue extends core.NodeSelectedValue>(
    selectedValue: utils.PlainObject,
    selection: core.NodeSelection<TValue>,
  ): TValue {
    if (!utils.isPlainObject(selectedValue)) {
      throw new utils.UnexpectedValueError('a plain-object', selectedValue);
    }

    return Array.from(selection.expressionsByKey.values()).reduce(
      (nodeSelectedValue, expression) => {
        const expressionPath = utils.addPath(undefined, expression.key);
        let expressionValue: any;

        if (expression instanceof core.LeafSelection) {
          const column = this.getColumnByLeaf(expression.leaf);
          const columnValue = selectedValue[column.name];

          expressionValue = column.dataType.fromColumnValue(columnValue);
        } else if (expression instanceof core.EdgeHeadSelection) {
          // const foreignKey = this.getForeignKeyByEdge(expression.edge);

          // WRONG, on ne cherche pas que dans la foreign key, on cherche dans tout le head
          // Genre Article { category { title }}
          // if (foreignKey.columns.some((column) => row[column.name] !== null)) {
          //   console.debug(
          //     foreignKey.columns.reduce(
          //       (edgeValue, column) => edgeValue,
          //       Object.create(null),
          //     ),
          //   );
          // } else {
          //   expressionValue = null;
          // }

          expressionValue = null;
        } else if (
          expression instanceof core.ReverseEdgeMultipleCountSelection
        ) {
          expressionValue = null;
        } else if (
          expression instanceof core.ReverseEdgeMultipleHeadSelection
        ) {
          expressionValue = null;
        } else if (expression instanceof core.ReverseEdgeUniqueHeadSelection) {
          expressionValue = null;
        } else {
          throw new UnreachableValueError(expression);
        }

        return Object.assign(nodeSelectedValue, {
          [expression.key]: expression.parseValue(
            expressionValue,
            expressionPath,
          ),
        });
      },
      Object.create(null),
    );
  }

  public makeCreateStatement(
    config?: CreateTableStatementConfig,
  ): CreateTableStatement {
    return new CreateTableStatement(this, config);
  }

  public async create(
    config?: CreateTableStatementConfig,
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<void> {
    await this.makeCreateStatement(config).execute(maybeConnection);
  }

  public makeAddForeignKeysStatement(
    config?: AddTableForeignKeysStatementConfig,
  ): AddTableForeignKeysStatement {
    return new AddTableForeignKeysStatement(this, config);
  }

  public async addForeignKeys(
    config?: AddTableForeignKeysStatementConfig,
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<void> {
    if (this.foreignKeysByEdge.size) {
      await this.makeAddForeignKeysStatement(config).execute(maybeConnection);
    }
  }

  public makeCountStatement(
    statement: core.ConnectorCountStatement,
    config?: CountStatementConfig,
  ): CountStatement {
    return new CountStatement(this, statement, config);
  }

  public async count(
    statement: core.ConnectorCountStatement,
    config?: CountStatementConfig,
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<number> {
    const [{ COUNT }] = await this.makeCountStatement(
      statement,
      config,
    ).execute(maybeConnection);

    return Number(COUNT);
  }

  public makeInsertStatement<TRow extends utils.PlainObject>(
    statement: core.ConnectorCreateStatement,
    config?: InsertStatementConfig,
  ): InsertStatement<TRow> {
    return new InsertStatement(this, statement, config);
  }

  public async insert(
    statement: core.ConnectorCreateStatement,
    config?: InsertStatementConfig,
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<core.NodeValue[]> {
    const rows = await this.makeInsertStatement(statement, config).execute(
      maybeConnection,
    );

    return rows.map((row) => this.parseRow(row));
  }

  public makeFindStatement<TTuple extends utils.PlainObject>(
    statement: core.ConnectorFindStatement,
    config?: FindStatementConfig,
  ): FindStatement<TTuple> {
    return new FindStatement(this, statement, config);
  }

  public async find(
    statement: core.ConnectorFindStatement,
    config?: FindStatementConfig,
    maybeConnection?: utils.Nillable<mariadb.Connection>,
  ): Promise<core.NodeSelectedValue[]> {
    const tuples = await this.makeFindStatement(statement, config).execute(
      maybeConnection,
    );

    return tuples.map((tuple) =>
      this.parseSelectedValue(tuple, statement.selection),
    );
  }
}
