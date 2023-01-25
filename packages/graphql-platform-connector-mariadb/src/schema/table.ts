import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { UnreachableValueError } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import type { MariaDBConnector, OkPacket } from '../index.js';
import type { Schema } from '../schema.js';
import {
  AddTableForeignKeysStatement,
  CountStatement,
  CreateTableStatement,
  DeleteStatement,
  FindStatement,
  InsertStatement,
  UpdateStatement,
  type AddTableForeignKeysStatementConfig,
  type CreateTableStatementConfig,
  type DeleteStatementConfig,
  type InsertStatementConfig,
  type UpdateStatementConfig,
} from '../statement.js';
import { ensureIdentifierName } from './naming-strategy.js';
import {
  LeafColumn,
  ReferenceColumnTree,
  type Column,
} from './table/column.js';
import { ForeignKey } from './table/foreign-key.js';
import {
  FullTextIndex,
  PlainIndex,
  PrimaryKey,
  UniqueIndex,
  type Index,
  type PlainIndexConfig,
} from './table/index.js';

export * from './table/column.js';
export * from './table/data-type.js';
export * from './table/diagnosis.js';
export * from './table/foreign-key.js';
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

  /**
   * Optional, some additional plain indexes
   */
  indexes?: (PlainIndexConfig | PlainIndexConfig['components'])[];
}

export class Table {
  public readonly config?: TableConfig;
  public readonly configPath: utils.Path;

  public readonly name: string;
  /**
   * @see https://mariadb.com/kb/en/identifier-qualifiers/
   */
  public readonly qualifiedName: string;
  public readonly engine: string;
  public readonly comment?: string;
  public readonly defaultCharset: string;
  public readonly defaultCollation: string;
  public readonly columnsByLeaf: ReadonlyMap<core.Leaf, LeafColumn>;
  public readonly primaryKey: PrimaryKey;
  public readonly uniqueIndexesByUniqueConstraint: ReadonlyMap<
    core.UniqueConstraint,
    UniqueIndex
  >;
  public readonly uniqueIndexes: ReadonlyArray<UniqueIndex>;
  public readonly fullTextIndexes: ReadonlyArray<FullTextIndex>;
  public readonly plainIndexes: ReadonlyArray<PlainIndex>;
  public readonly indexes: ReadonlyArray<Index>;
  public readonly foreignKeysByEdge: ReadonlyMap<core.Edge, ForeignKey>;
  public readonly foreignKeys: ReadonlyArray<ForeignKey>;

  public constructor(
    public readonly schema: Schema,
    public readonly node: core.Node<any, MariaDBConnector>,
  ) {
    // config
    {
      this.config = node.config.table;
      this.configPath = utils.addPath(node.configPath, 'table');

      utils.assertNillablePlainObject(this.config, this.configPath);
    }

    // name
    {
      const nameConfig = this.config?.name;
      const nameConfigPath = utils.addPath(this.configPath, 'name');

      this.name = nameConfig
        ? ensureIdentifierName(nameConfig, nameConfigPath)
        : schema.namingStrategy.getTableName(this);
    }

    // qualified-name
    {
      this.qualifiedName = `${this.schema.name}.${this.name}`;
    }

    // comment
    {
      this.comment = node.description?.substring(0, 2048);
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
        node.leaves.map((leaf) => [leaf, new LeafColumn(this, leaf)]),
      );
    }

    // primary-key
    {
      this.primaryKey = new PrimaryKey(this, node.identifier);
    }

    // unique-indexes-by-unique-constraint
    {
      this.uniqueIndexesByUniqueConstraint = new Map(
        node.uniqueConstraints
          .filter((uniqueConstraint) => !uniqueConstraint.isIdentifier())
          .map((uniqueConstraint) => [
            uniqueConstraint,
            new UniqueIndex(this, uniqueConstraint),
          ]),
      );

      this.uniqueIndexes = Array.from(
        this.uniqueIndexesByUniqueConstraint.values(),
      );
    }

    // full-text-indexes-by-leaf
    {
      this.fullTextIndexes = Object.freeze(
        Array.from(this.columnsByLeaf.values()).reduce<FullTextIndex[]>(
          (indexes, column) =>
            column.fullTextIndex ? [...indexes, column.fullTextIndex] : indexes,
          [],
        ),
      );
    }

    // plain-indexes
    {
      const indexesConfig = this.config?.indexes;
      const indexesConfigPath = utils.addPath(this.configPath, 'indexes');

      if (indexesConfig !== undefined && !Array.isArray(indexesConfig)) {
        throw new utils.UnexpectedValueError(`an array`, indexesConfig, {
          path: indexesConfigPath,
        });
      }

      this.plainIndexes = Object.freeze(
        (indexesConfig ?? []).reduce<PlainIndex[]>(
          (indexes, config, index) => [
            ...indexes,
            new PlainIndex(
              this,
              (Array.isArray(config)
                ? { components: config }
                : config) as PlainIndexConfig,
              utils.addPath(indexesConfigPath, index),
            ),
          ],
          [],
        ),
      );
    }

    this.indexes = Object.freeze([
      this.primaryKey,
      ...this.uniqueIndexes,
      ...this.fullTextIndexes,
      ...this.plainIndexes,
    ]);

    // foreign-keys-by-edge
    {
      this.foreignKeysByEdge = new Map(
        node.edges.map((edge) => [edge, new ForeignKey(this, edge)]),
      );

      this.foreignKeys = Array.from(this.foreignKeysByEdge.values());
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
      this.node.edges.map((edge) => [
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
    return Object.freeze(this.getColumnsByComponents(...this.node.components));
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
    path: utils.Path = utils.addPath(undefined, this.node.name),
  ): TValue {
    utils.assertPlainObject(row, path);

    const emptyColumns = this.columns.filter(
      (column) => row[column.name] === undefined,
    );

    if (emptyColumns.length) {
      throw new utils.UnexpectedValueError(
        `the column(s) "${emptyColumns
          .map((column) => column.name)
          .join(', ')}" to be defined`,
        row,
        { path },
      );
    }

    return utils.aggregateGraphError<core.Component, TValue>(
      this.node.components,
      (document, component) =>
        Object.assign(document, {
          [component.name]: component.parseValue(
            component instanceof core.Leaf
              ? this.getColumnByLeaf(component).pickLeafValueFromRow(row)
              : this.getColumnTreeByEdge(component).pickReferenceValueFromRow(
                  row,
                ),
            utils.addPath(path, component.name),
          ),
        }),
      Object.create(null),
    );
  }

  public parseJsonDocument<TValue extends core.NodeSelectedValue>(
    jsonDocument: utils.PlainObject,
    selection: core.NodeSelection<TValue>,
    path: utils.Path = utils.addPath(undefined, this.node.name),
  ): TValue {
    utils.assertPlainObject(jsonDocument, path);

    return utils.aggregateGraphError(
      selection.expressions,
      (document, expression) => {
        const expressionPath = utils.addPath(path, expression.key);
        const jsonValue = jsonDocument[expression.key];
        let expressionValue: any;

        if (expression instanceof core.LeafSelection) {
          const column = this.getColumnByLeaf(expression.leaf);

          expressionValue = column.dataType.parseJsonValue(jsonValue);
        } else if (expression instanceof core.EdgeHeadSelection) {
          const head = this.schema.getTableByNode(expression.edge.head);

          expressionValue = jsonValue
            ? head.parseJsonDocument(
                jsonValue,
                expression.headSelection,
                expressionPath,
              )
            : null;
        } else if (
          expression instanceof core.ReverseEdgeMultipleCountSelection
        ) {
          expressionValue = Number.parseInt(jsonValue, 10);
        } else if (
          expression instanceof core.ReverseEdgeMultipleHeadSelection
        ) {
          const head = this.schema.getTableByNode(expression.reverseEdge.head);

          expressionValue = Array.isArray(jsonValue)
            ? jsonValue.map((value, index) =>
                head.parseJsonDocument(
                  value,
                  expression.headSelection,
                  utils.addPath(expressionPath, index),
                ),
              )
            : [];
        } else if (expression instanceof core.ReverseEdgeUniqueHeadSelection) {
          const head = this.schema.getTableByNode(expression.reverseEdge.head);

          expressionValue = jsonValue
            ? head.parseJsonDocument(
                jsonValue,
                expression.headSelection,
                expressionPath,
              )
            : null;
        } else {
          throw new UnreachableValueError(expression);
        }

        return Object.assign(document, {
          [expression.key]: expression.parseValue(
            expressionValue,
            expressionPath,
          ),
        });
      },
      Object.create(null),
    );
  }

  public async create(
    config?: CreateTableStatementConfig,
    maybeConnection?: mariadb.Connection,
  ): Promise<void> {
    await this.schema.connector.executeStatement(
      new CreateTableStatement(this, config),
      maybeConnection,
    );
  }

  public async addForeignKeys(
    config?: AddTableForeignKeysStatementConfig,
    maybeConnection?: mariadb.Connection,
  ): Promise<void> {
    if (this.foreignKeysByEdge.size) {
      await this.schema.connector.executeStatement(
        new AddTableForeignKeysStatement(this, config),
        maybeConnection,
      );
    }
  }

  public async count(
    statement: core.ConnectorCountStatement,
    context: core.OperationContext,
    maybeConnection?: mariadb.Connection,
  ): Promise<number> {
    const [{ COUNT }] = await this.schema.connector.executeStatement<
      [{ COUNT: bigint }]
    >(new CountStatement(this, statement, context), maybeConnection);

    return Number(COUNT);
  }

  public async find<TValue extends core.NodeSelectedValue>(
    statement: core.ConnectorFindStatement<TValue>,
    context: core.OperationContext,
    maybeConnection?: mariadb.Connection,
  ): Promise<TValue[]> {
    const tuples = await this.schema.connector.executeStatement<
      utils.PlainObject[]
    >(new FindStatement(this, statement, context), maybeConnection);

    return tuples.map((tuple) =>
      this.parseJsonDocument(
        JSON.parse(tuple[this.node.name]),
        statement.selection,
      ),
    );
  }

  public async insert(
    statement: core.ConnectorCreateStatement,
    context: core.MutationContext,
    connection: mariadb.Connection,
    config?: InsertStatementConfig,
  ): Promise<core.NodeValue[]> {
    const rows = await this.schema.connector.executeStatement<
      utils.PlainObject[]
    >(new InsertStatement(this, statement, context, config), connection);

    return rows.map((row) => this.parseRow(row));
  }

  public async update(
    statement: core.ConnectorUpdateStatement,
    context: core.MutationContext,
    connection: mariadb.Connection,
    config?: UpdateStatementConfig,
  ): Promise<number> {
    const { affectedRows } =
      await this.schema.connector.executeStatement<OkPacket>(
        new UpdateStatement(this, statement, context, config),
        connection,
      );

    return affectedRows;
  }

  public async delete(
    statement: core.ConnectorDeleteStatement,
    context: core.MutationContext,
    connection: mariadb.Connection,
    config?: DeleteStatementConfig,
  ): Promise<number> {
    const { affectedRows } =
      await this.schema.connector.executeStatement<OkPacket>(
        new DeleteStatement(this, statement, context, config),
        connection,
      );

    return affectedRows;
  }
}
