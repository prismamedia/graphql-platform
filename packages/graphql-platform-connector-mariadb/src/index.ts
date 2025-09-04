import {
  AsyncEventEmitter,
  type EventConfigByName,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as mariadb from 'mariadb';
import assert from 'node:assert';
import { hrtime } from 'node:process';
import * as semver from 'semver';
import type { Except } from 'type-fest';
import { MariaDBBroker, type MariaDBBrokerOptions } from './broker.js';
import { trace } from './instrumentation.js';
import {
  Schema,
  type ForeignKeyIndexConfig,
  type LeafColumnConfig,
  type ReferenceColumnTreeConfig,
  type SchemaConfig,
  type TableConfig,
  type UniqueIndexConfig,
} from './schema.js';
import {
  InsertStatement,
  StatementKind,
  UpdateStatement,
  type Statement,
} from './statement.js';

export * as mariadb from 'mariadb';
export * from './broker.js';
export * from './escaping.js';
export * from './schema.js';
export * from './statement.js';

export type PoolConnection<TKind extends StatementKind = any> =
  mariadb.PoolConnection & {
    kind: TKind;
  } & AsyncDisposable;

/**
 * @see https://mariadb.com/kb/en/ok_packet/
 */
export type OkPacket = {
  affectedRows: number;
  insertId: bigint;
  warningStatus: number;
};

export type MariaDBConnectorEventDataByName = {
  'executed-statement': {
    statement: Statement;
    result: any;
    durationInSeconds: number;
  };
  'failed-statement': {
    statement: Statement;
    error: mariadb.SqlError;
    durationInSeconds: number;
  };
};

export interface MariaDBConnectorConfig<TRequestContext extends object = any> {
  useCommonTableExpression?: boolean;
  charset?: string;
  collation?: string;
  version?: string;
  schema?: SchemaConfig;
  pool?: Except<mariadb.PoolConfig, 'logger'>;
  on?: EventConfigByName<MariaDBConnectorEventDataByName>;
  broker?:
    | MariaDBBrokerOptions<TRequestContext>
    | MariaDBBrokerOptions['enabled'];
}

/**
 * @see https://mariadb.com/kb/en/nodejs-connector/
 */
export class MariaDBConnector<TRequestContext extends object = any>
  extends AsyncEventEmitter<MariaDBConnectorEventDataByName>
  implements core.ConnectorInterface
{
  public readonly configOverrides?: {
    [core.ConnectorConfigOverrideKind.NODE]: {
      /**
       * Optional, customize the node's table
       */
      table?: TableConfig;
    };
    [core.ConnectorConfigOverrideKind.FEATURE]: {
      /**
       * Optional, customize the node's table
       */
      table?: Pick<TableConfig, 'indexes'>;
    };
    [core.ConnectorConfigOverrideKind.LEAF]: {
      /**
       * Optional, customize the leaf's column
       */
      column?: LeafColumnConfig;
    };
    [core.ConnectorConfigOverrideKind.EDGE]: {
      /**
       * Optional, customize the edge's columns' name
       */
      columns?: ReferenceColumnTreeConfig;

      /**
       * Optional, customize the edge's foreign-key
       */
      foreignKey?: ForeignKeyIndexConfig;
    };
    [core.ConnectorConfigOverrideKind.UNIQUE_CONSTRAINT]: {
      /**
       * Optional, customize the unique-constraint's index
       */
      index?: UniqueIndexConfig;
    };
  };

  public readonly useCommonTableExpression: boolean;

  public readonly poolConfig?: Except<mariadb.PoolConfig, 'logger'>;
  public readonly poolConfigPath: utils.Path;

  public readonly charset: string;
  public readonly collation: string;
  public readonly version?: semver.SemVer;
  public readonly schema: Schema;

  readonly #poolsByStatementKind = new Map<
    StatementKind,
    mariadb.Pool & { kind: StatementKind }
  >();

  readonly #connectionsByMutation = new WeakMap<
    core.MutationContext,
    PoolConnection
  >();

  #eventSchedulerIsEnabled?: boolean;

  public constructor(
    public readonly gp: core.GraphQLPlatform<TRequestContext>,
    public readonly config: MariaDBConnectorConfig<TRequestContext>,
    public readonly configPath: utils.Path = utils.addPath(
      gp.configPath,
      'connector',
    ),
  ) {
    utils.assertPlainObject(config, configPath);

    super(config.on);

    this.useCommonTableExpression = utils.getOptionalFlag(
      config.useCommonTableExpression,
      true,
    );

    // pool-config
    {
      this.poolConfig = config.pool || undefined;
      this.poolConfigPath = utils.addPath(configPath, 'pool');

      utils.assertNillablePlainObject(this.poolConfig, this.poolConfigPath);
    }

    this.charset = config.charset || 'utf8mb4';
    this.collation = config.collation || 'utf8mb4_unicode_520_ci';
    this.version =
      (config.version && semver.coerce(config.version)) || undefined;
    this.schema = new Schema(this);
  }

  @MGetter
  public get broker(): MariaDBBroker | undefined {
    const config: MariaDBBrokerOptions | undefined =
      this.config.broker == null
        ? undefined
        : typeof this.config.broker === 'boolean'
          ? { enabled: this.config.broker }
          : { enabled: true, ...this.config.broker };

    const configPath = utils.addPath(this.configPath, 'broker');

    return utils.getOptionalFlag(
      config?.enabled,
      false,
      utils.addPath(configPath, 'enabled'),
    )
      ? new MariaDBBroker(this, config)
      : undefined;
  }

  public getPool(
    kind: StatementKind = StatementKind.DATA_MANIPULATION,
  ): mariadb.Pool & { kind: StatementKind } {
    let pool = this.#poolsByStatementKind.get(kind);
    if (!pool) {
      utils.assertPlainObject(this.poolConfig, this.poolConfigPath);

      this.#poolsByStatementKind.set(
        kind,
        (pool = Object.assign(
          mariadb.createPool(
            kind === StatementKind.DATA_MANIPULATION
              ? {
                  ...this.poolConfig,
                  sessionVariables: {
                    ...this.poolConfig?.sessionVariables,
                    // For "JSON_ARRAYAGG" & "JSON_OBJECTAGG", 100M instead of the default 1M
                    group_concat_max_len: 104857600,
                  },
                  autoJsonMap: false,
                  bigIntAsNumber: false,
                  charset: this.charset,
                  collation: this.collation,
                  database: this.schema.name,
                  dateStrings: true,
                  decimalAsNumber: true,
                  insertIdAsNumber: false,
                  multipleStatements: false,
                  timezone: 'Z',
                  ...({ bitOneIsBoolean: false } as any),
                }
              : { ...this.poolConfig, connectionLimit: 1 },
          ),
          { kind },
        )),
      );
    }

    return pool;
  }

  public async disconnect(): Promise<void> {
    await Promise.all(
      Array.from(this.#poolsByStatementKind.values(), async (pool) => {
        try {
          await pool.end();
        } finally {
          this.#poolsByStatementKind.delete(pool.kind);
        }
      }),
    );
  }

  public async getConnection<TKind extends StatementKind = any>(
    kind?: TKind,
  ): Promise<PoolConnection<TKind>> {
    const pool = this.getPool(kind);
    const connection = await pool.getConnection();

    return Object.assign(connection, {
      kind: pool.kind,
      [Symbol.asyncDispose]: () => connection.release(),
    }) as unknown as PoolConnection<TKind>;
  }

  public async withConnection<
    TResult = unknown,
    TKind extends StatementKind = any,
  >(
    task: (connection: PoolConnection<TKind>) => Promise<TResult>,
    kind?: TKind,
    maybeConnection?: PoolConnection<TKind>,
  ): Promise<TResult> {
    if (kind && maybeConnection) {
      assert.strictEqual(maybeConnection.kind, kind);

      return task(maybeConnection);
    }

    await using connection = await this.getConnection(kind);

    return await task(connection);
  }

  public async withConnectionInTransaction<
    TResult = unknown,
    TKind extends StatementKind = any,
  >(
    task: (connection: PoolConnection<TKind>) => Promise<TResult>,
    kind?: TKind,
  ): Promise<TResult> {
    await using connection = await this.getConnection(kind);
    await connection.beginTransaction();

    try {
      const result = await task(connection);

      await connection.commit();

      return result;
    } catch (error) {
      await connection.rollback();

      throw error;
    }
  }

  public async executeQuery<TResult extends OkPacket | utils.PlainObject[]>(
    query: string | mariadb.QueryOptions,
    values?: any,
    kind?: StatementKind,
  ): Promise<TResult> {
    await using connection = await this.getConnection(kind);

    return await connection.query(query, values);
  }

  /**
   * Returns the first row, if any
   */
  public async getRowIfExists<TRow extends utils.PlainObject>(
    query: string | mariadb.QueryOptions,
    values?: any,
    kind?: StatementKind,
  ): Promise<TRow | undefined> {
    const rows = await this.executeQuery<[TRow]>(query, values, kind);
    assert(Array.isArray(rows), `Expects a result-set`);

    return rows[0];
  }

  /**
   * Returns the first row
   */
  public async getRow<TRow extends utils.PlainObject>(
    query: string | mariadb.QueryOptions,
    values?: any,
    kind?: StatementKind,
  ): Promise<TRow> {
    const row = await this.getRowIfExists<TRow>(query, values, kind);
    assert(row, `Not found`);

    return row;
  }

  /**
   * Returns the first column of the first row
   */
  public async getColumn<TValue>(
    query: string | mariadb.QueryOptions,
    values?: any,
    kind?: StatementKind,
  ): Promise<TValue> {
    const row = await this.getRow(query, values, kind);
    const columns = Object.values(row);
    assert(columns.length, `Expects a column`);

    return columns[0];
  }

  public async executeStatement<TResult extends OkPacket | utils.PlainObject[]>(
    statement: Statement,
    connection?: PoolConnection,
    path?: utils.Path,
  ): Promise<TResult> {
    return trace(
      'statement.execution',
      async () => {
        const startedAt = hrtime.bigint();

        let result: any;

        try {
          result = await this.withConnection(
            (connection) => connection.query(statement),
            statement.kind,
            connection,
          );

          await this.emit('executed-statement', {
            statement,
            result,
            durationInSeconds:
              Math.round(Number(hrtime.bigint() - startedAt) / 10 ** 6) /
              10 ** 3,
          });
        } catch (error) {
          if (error instanceof mariadb.SqlError) {
            const durationInSeconds =
              Math.round(Number(hrtime.bigint() - startedAt) / 10 ** 6) /
              10 ** 3;

            Object.assign(error, { sql: statement.sql, durationInSeconds });

            await this.emit('failed-statement', {
              statement,
              error,
              durationInSeconds,
            });

            if ('context' in statement && 'table' in statement) {
              switch (error.errno) {
                case 1062: {
                  const match = error.sqlMessage?.match(
                    /Duplicate entry '(?<value>.+)' for key '(?<unique>.+)'/,
                  );

                  const uniqueIndex = match?.groups?.unique
                    ? match?.groups?.unique === 'PRIMARY'
                      ? statement.table.primaryKey
                      : statement.table.uniqueIndexes.find(
                          (uniqueIndex) =>
                            uniqueIndex.name === match?.groups?.unique,
                        )
                    : undefined;

                  throw new core.DuplicateError(
                    statement.context.request,
                    statement.table.node,
                    {
                      ...('mutationType' in statement && {
                        mutationType: statement.mutationType,
                      }),
                      uniqueConstraint: uniqueIndex?.uniqueConstraint,
                      hint: match?.groups?.value,
                      cause: error,
                      path,
                    },
                  );
                }

                case 1969:
                  throw new core.ConnectorOperationError(
                    statement.context.request,
                    statement.table.node,
                    { cause: error, path, reason: 'timeout' },
                  );

                default:
                  throw new core.ConnectorOperationError(
                    statement.context.request,
                    statement.table.node,
                    {
                      cause: error,
                      path,
                      ...(error.sqlMessage && { reason: error.sqlMessage }),
                    },
                  );
              }
            }
          }

          throw 'context' in statement && 'table' in statement
            ? new core.ConnectorOperationError(
                statement.context.request,
                statement.table.node,
                { cause: error, path },
              )
            : error;
        }

        return result;
      },
      {
        attributes: {
          'statement.kind': StatementKind[statement.kind],
          'statement.sql':
            statement instanceof InsertStatement ||
            statement instanceof UpdateStatement
              ? undefined
              : statement.sql,
        },
      },
    );
  }

  public async ensureEventSchedulerIsEnabled(
    connection?: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    if (!this.#eventSchedulerIsEnabled) {
      await this.withConnection(
        async (connection) => {
          const [{ Value }] = await connection.query<
            [{ Variable_name: 'event_scheduler'; Value: 'ON' | 'OFF' }]
          >(`SHOW GLOBAL VARIABLES LIKE 'event_scheduler';`);

          if (Value !== 'ON') {
            await connection.query(`SET GLOBAL event_scheduler = ON;`);
          }
        },
        StatementKind.DATA_DEFINITION,
        connection,
      );

      this.#eventSchedulerIsEnabled = true;
    }
  }

  /**
   * WARNING: For test-use only!
   *
   * It will DESTROY all the schema's structure & data
   */
  public async setup(): Promise<void> {
    await this.withConnectionInTransaction(async (connection) => {
      // Drop the schema, if exists
      await this.schema.drop({ ifExists: true }, connection);

      // Then create it
      await this.schema.create(undefined, connection);

      // Create the tables without their foreign-keys
      await Promise.all(
        Array.from(this.schema.tablesByNode.values(), (table) =>
          table.create({ withForeignKeys: false }, connection),
        ),
      );

      // Then add their foreign-keys, if any
      await Promise.all(
        Array.from(this.schema.tablesByNode.values(), (table) =>
          table.addForeignKeys(undefined, connection),
        ),
      );

      // Setup the broker, if enabled
      await this.broker?.setup(connection);
    }, StatementKind.DATA_DEFINITION);
  }

  /**
   * WARNING: For test-use only!
   *
   * It will DESTROY all the schema's structure & data
   */
  public async teardown(): Promise<void> {
    try {
      await this.schema.drop({ ifExists: true });
    } finally {
      await this.disconnect();
    }
  }

  public async preMutation(context: core.MutationContext): Promise<void> {
    const connection = await this.getConnection(
      StatementKind.DATA_MANIPULATION,
    );
    await connection.beginTransaction();

    this.#connectionsByMutation.set(context, connection);
  }

  /**
   * Gets the current mutation's transactional connection
   */
  public getConnectionForMutation(
    context: core.MutationContext,
  ): PoolConnection {
    const connection = this.#connectionsByMutation.get(context);
    assert(connection, `The connection has been released`);

    return connection;
  }

  public async postSuccessfulMutation(
    context: core.MutationContext,
  ): Promise<void> {
    await this.getConnectionForMutation(context).commit();
  }

  public async postFailedMutation(
    context: core.MutationContext,
    _cause: Error,
  ): Promise<void> {
    await this.getConnectionForMutation(context).rollback();
  }

  public async postMutation(context: core.MutationContext): Promise<void> {
    try {
      await this.getConnectionForMutation(context).release();
    } finally {
      this.#connectionsByMutation.delete(context);
    }
  }

  public async count(
    context: core.OperationContext,
    { node, ...statement }: core.ConnectorCountStatement,
    path?: utils.Path,
  ): Promise<number> {
    const table = this.schema.getTableByNode(node);
    const maybeConnection =
      context instanceof core.MutationContext
        ? this.getConnectionForMutation(context)
        : undefined;

    return table.count(context, statement, maybeConnection, path);
  }

  public async find<TValue extends core.NodeSelectedValue>(
    context: core.OperationContext,
    { node, ...statement }: core.ConnectorFindStatement<TValue>,
    path?: utils.Path,
  ): Promise<TValue[]> {
    const table = this.schema.getTableByNode(node);
    const maybeConnection =
      context instanceof core.MutationContext
        ? this.getConnectionForMutation(context)
        : undefined;

    return table.find(context, statement, maybeConnection, path);
  }

  public async create(
    context: core.MutationContext,
    { node, ...statement }: core.ConnectorCreateStatement,
    path?: utils.Path,
  ): Promise<core.NodeValue[]> {
    const table = this.schema.getTableByNode(node);
    const connection = this.getConnectionForMutation(context);

    return table.insert(context, statement, connection, undefined, path);
  }

  public async update(
    context: core.MutationContext,
    { node, ...statement }: core.ConnectorUpdateStatement,
    path?: utils.Path,
  ): Promise<number> {
    const table = this.schema.getTableByNode(node);
    const connection = this.getConnectionForMutation(context);

    return table.update(context, statement, connection, undefined, path);
  }

  public async delete(
    context: core.MutationContext,
    { node, ...statement }: core.ConnectorDeleteStatement,
    path?: utils.Path,
  ): Promise<number> {
    const table = this.schema.getTableByNode(node);
    const connection = this.getConnectionForMutation(context);

    return table.delete(context, statement, connection, undefined, path);
  }
}
