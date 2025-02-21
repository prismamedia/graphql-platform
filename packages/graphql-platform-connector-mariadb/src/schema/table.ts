import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { UnreachableValueError } from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { SetOptional } from 'type-fest';
import type { MariaDBConnector, OkPacket, PoolConnection } from '../index.js';
import type { Schema } from '../schema.js';
import {
  AddTableForeignKeysStatement,
  CountStatement,
  CreateTableStatement,
  DeleteStatement,
  DropTableForeignKeysStatement,
  FindStatement,
  InsertStatement,
  NormalizeStatement,
  RevalidateSubscriptionStatement,
  StatementKind,
  UpdateStatement,
  type CreateTableStatementConfig,
  type DeleteStatementConfig,
  type InsertStatementConfig,
  type NormalizeStatementConfig,
  type UpdateStatementConfig,
} from '../statement.js';
import { ensureIdentifierName } from './naming-strategy.js';
import {
  LeafColumn,
  ReferenceColumnTree,
  type Column,
  type SubscriptionsStateColumnOptions,
} from './table/column.js';
import { SubscriptionsStateColumn } from './table/column/subscriptions-state.js';
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
   * @default `node's name plural in snake_cased`
   */
  name?: utils.Nillable<string>;

  /**
   * Optional, the table's default charset
   *
   * @default `the schema's default charset`
   */
  defaultCharset?: utils.Nillable<string>;

  /**
   * Optional, the table's default collation
   *
   * @default `the schema's default collation`
   */
  defaultCollation?: utils.Nillable<string>;

  /**
   * Optional, some additional plain indexes
   */
  indexes?: (PlainIndexConfig | PlainIndexConfig['components'])[];

  subscriptionsState?:
    | SubscriptionsStateColumnOptions['enabled']
    | SubscriptionsStateColumnOptions;
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

  public readonly subscriptionsStateColumn?: SubscriptionsStateColumn;

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
      this.qualifiedName = `${this.schema}.${this.name}`;
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
        Array.from(node.leavesByName.values(), (leaf) => [
          leaf,
          new LeafColumn(this, leaf),
        ]),
      );
    }

    // subscriptions-state-column
    {
      const subscriptionsStateConfig:
        | SubscriptionsStateColumnOptions
        | undefined =
        typeof this.config?.subscriptionsState === 'boolean'
          ? { enabled: this.config.subscriptionsState }
          : utils.isPlainObject(this.config?.subscriptionsState)
            ? { enabled: true, ...this.config!.subscriptionsState }
            : undefined;

      const subscriptionsStateConfigPath = utils.addPath(
        this.configPath,
        'subscriptionsState',
      );

      this.subscriptionsStateColumn =
        node.getSubscriptionByKey('changes').isEnabled() &&
        utils.getOptionalFlag(
          subscriptionsStateConfig?.enabled,
          false,
          utils.addPath(subscriptionsStateConfigPath, 'enabled'),
        )
          ? new SubscriptionsStateColumn(this, subscriptionsStateConfig)
          : undefined;
    }

    // primary-key
    {
      this.primaryKey = new PrimaryKey(this, node.mainIdentifier);
    }

    // unique-indexes-by-unique-constraint
    {
      this.uniqueIndexesByUniqueConstraint = new Map(
        node.uniqueConstraintsByName
          .values()
          .filter((uniqueConstraint) => !uniqueConstraint.isMainIdentifier())
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
        Array.from(node.edgesByName.values(), (edge) => [
          edge,
          new ForeignKey(this, edge),
        ]),
      );

      this.foreignKeys = Array.from(this.foreignKeysByEdge.values());
    }
  }

  public toString(): string {
    return this.qualifiedName;
  }

  public getColumnByLeaf(
    leafOrName: core.Leaf | core.Leaf['name'],
  ): LeafColumn {
    const leaf = this.node.ensureLeaf(leafOrName);
    const column = this.columnsByLeaf.get(leaf);
    assert(column, `No column found for the leaf "${leaf}"`);

    return column;
  }

  @MGetter
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
    assert(columnTree, `No columns found for the edge "${edge}"`);

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

  @MGetter
  public get columns(): ReadonlyArray<Column> {
    return Object.freeze(
      [
        ...this.getColumnsByComponents(...this.node.componentsByName.values()),
        this.subscriptionsStateColumn,
      ].filter((column) => column !== undefined),
    );
  }

  public getUniqueIndexByUniqueConstraint(
    uniqueConstraint: core.UniqueConstraint,
  ): UniqueIndex {
    const uniqueIndex =
      this.uniqueIndexesByUniqueConstraint.get(uniqueConstraint);
    assert(
      uniqueIndex,
      `No unique-index found for the unique-constraint "${uniqueConstraint}"`,
    );

    return uniqueIndex;
  }

  public getForeignKeyByEdge(
    edgeOrName: core.Edge | core.Edge['name'],
  ): ForeignKey {
    const edge = this.node.ensureEdge(edgeOrName);
    const foreignKey = this.foreignKeysByEdge.get(edge);
    assert(foreignKey, `No foreign-key found for the edge "${edge}"`);

    return foreignKey;
  }

  protected parseRow<TValue extends core.NodeValue>(
    row: utils.PlainObject,
    path: utils.Path = utils.addPath(undefined, this.node.name),
  ): TValue {
    utils.assertPlainObject(row, path);

    return Array.from(this.node.componentSet).reduce((result, component) => {
      result[component.name] =
        component instanceof core.Leaf
          ? this.getColumnByLeaf(component).pickLeafValueFromRow(row)
          : this.getColumnTreeByEdge(component).pickReferenceValueFromRow(row);

      return result;
    }, Object.create(null));
  }

  public parseJsonDocument<TValue extends core.NodeSelectedValue>(
    jsonDocument: utils.PlainObject,
    selection: core.NodeSelection<TValue>,
    path: utils.Path = utils.addPath(undefined, this.node.name),
  ): TValue {
    utils.assertPlainObject(jsonDocument, path);

    return selection.expressions.reduce((result, expression) => {
      const expressionPath = utils.addPath(path, expression.key);
      const jsonValue = jsonDocument[expression.key];

      if (expression instanceof core.LeafSelection) {
        const column = this.getColumnByLeaf(expression.leaf);

        result[expression.key] = column.dataType.parseJsonValue(jsonValue);
      } else if (expression instanceof core.EdgeHeadSelection) {
        const head = this.schema.getTableByNode(expression.edge.head);

        result[expression.key] = jsonValue
          ? head.parseJsonDocument(
              jsonValue,
              expression.headSelection,
              expressionPath,
            )
          : null;
      } else if (expression instanceof core.MultipleReverseEdgeCountSelection) {
        result[expression.key] = Number.parseInt(jsonValue, 10);
      } else if (expression instanceof core.MultipleReverseEdgeHeadSelection) {
        const head = this.schema.getTableByNode(expression.reverseEdge.head);

        result[expression.key] = Array.isArray(jsonValue)
          ? jsonValue.map((value, index) =>
              head.parseJsonDocument(
                value,
                expression.headSelection,
                utils.addPath(expressionPath, index),
              ),
            )
          : [];
      } else if (expression instanceof core.UniqueReverseEdgeHeadSelection) {
        const head = this.schema.getTableByNode(expression.reverseEdge.head);

        result[expression.key] = jsonValue
          ? head.parseJsonDocument(
              jsonValue,
              expression.headSelection,
              expressionPath,
            )
          : null;
      } else if (expression instanceof core.VirtualSelection) {
        result[expression.key] = expression.sourceSelection
          ? this.parseJsonDocument(
              jsonValue,
              expression.sourceSelection,
              expressionPath,
            )
          : undefined;
      } else {
        throw new UnreachableValueError(expression);
      }

      return result;
    }, Object.create(null));
  }

  public async create(
    config?: CreateTableStatementConfig,
    connection?: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    await this.schema.connector.withConnection(
      async (connection) => {
        await this.schema.connector.executeStatement(
          new CreateTableStatement(this, config),
          connection,
        );

        await this.subscriptionsStateColumn?.janitor.create(
          { orReplace: true },
          connection,
        );
      },
      StatementKind.DATA_DEFINITION,
      connection,
    );
  }

  public async dropForeignKeys(
    foreignKeys: ReadonlyArray<ForeignKey | ForeignKey['name']> = this
      .foreignKeys,
    connection?: PoolConnection,
  ): Promise<void> {
    if (foreignKeys.length) {
      await this.schema.connector.executeStatement(
        new DropTableForeignKeysStatement(this, foreignKeys),
        connection,
      );
    }
  }

  public async addForeignKeys(
    foreignKeys: ReadonlyArray<ForeignKey> = this.foreignKeys,
    connection?: PoolConnection,
  ): Promise<void> {
    if (foreignKeys.length) {
      await this.schema.connector.executeStatement(
        new AddTableForeignKeysStatement(this, foreignKeys),
        connection,
      );
    }
  }

  public async normalize(
    config?: NormalizeStatementConfig,
    connection?: PoolConnection,
  ): Promise<void> {
    if (NormalizeStatement.normalizations(this, config).size) {
      await this.schema.connector.executeStatement(
        new NormalizeStatement(this, config),
        connection,
      );
    }
  }

  public async count(
    context: core.OperationContext,
    statement: SetOptional<core.ConnectorCountStatement, 'node'>,
    connection?: PoolConnection,
  ): Promise<number> {
    const [{ COUNT }] = await this.schema.connector.executeStatement<
      [{ COUNT: bigint }]
    >(new CountStatement(this, context, statement), connection);

    return Number(COUNT);
  }

  public async find<TValue extends core.NodeSelectedValue>(
    context: core.OperationContext,
    statement: SetOptional<core.ConnectorFindStatement<TValue>, 'node'>,
    connection?: PoolConnection,
  ): Promise<TValue[]> {
    const findStatement = new FindStatement(this, context, statement);

    const revalidatedAt = new Date();
    const rows = await this.schema.connector.executeStatement<
      utils.PlainObject[]
    >(findStatement, connection);

    if (
      rows.length &&
      statement.forSubscription &&
      this.subscriptionsStateColumn
    ) {
      await this.schema.connector.executeStatement<OkPacket>(
        new RevalidateSubscriptionStatement(
          this,
          rows,
          statement.forSubscription,
          revalidatedAt,
        ),
        connection,
      );
    }

    return rows.map((row) =>
      this.parseJsonDocument(
        JSON.parse(row[findStatement.selectionKey]),
        statement.selection,
      ),
    );
  }

  public async insert(
    context: core.MutationContext,
    statement: SetOptional<core.ConnectorCreateStatement, 'node'>,
    connection: PoolConnection,
    config?: InsertStatementConfig,
  ): Promise<core.NodeValue[]> {
    const rows = await this.schema.connector.executeStatement<
      utils.PlainObject[]
    >(new InsertStatement(this, context, statement, config), connection);

    return rows.map((row) => this.parseRow(row));
  }

  public async update(
    context: core.MutationContext,
    statement: SetOptional<core.ConnectorUpdateStatement, 'node'>,
    connection: PoolConnection,
    config?: UpdateStatementConfig,
  ): Promise<number> {
    const { affectedRows } =
      await this.schema.connector.executeStatement<OkPacket>(
        new UpdateStatement(this, context, statement, config),
        connection,
      );

    return affectedRows;
  }

  public async delete(
    context: core.MutationContext,
    statement: SetOptional<core.ConnectorDeleteStatement, 'node'>,
    connection: PoolConnection,
    config?: DeleteStatementConfig,
  ): Promise<number> {
    const { affectedRows } =
      await this.schema.connector.executeStatement<OkPacket>(
        new DeleteStatement(this, context, statement, config),
        connection,
      );

    return affectedRows;
  }
}
