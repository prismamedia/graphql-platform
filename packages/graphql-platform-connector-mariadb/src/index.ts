import {
  AsyncEventEmitter,
  type EventConfigByName,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { hrtime } from 'node:process';
import * as semver from 'semver';
import type { Except } from 'type-fest';
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
  Statement,
  StatementKind,
  UpdateStatement,
} from './statement.js';

export * as mariadb from 'mariadb';
export * from './escaping.js';
export * from './schema.js';
export * from './statement.js';

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

export interface MariaDBConnectorConfig {
  charset?: string;
  collation?: string;
  version?: string;
  schema?: SchemaConfig;
  pool?: Except<mariadb.PoolConfig, 'logger'>;
  on?: EventConfigByName<MariaDBConnectorEventDataByName>;
}

/**
 * @see https://mariadb.com/kb/en/nodejs-connector/
 */
export class MariaDBConnector
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

  public readonly poolConfig?: Except<mariadb.PoolConfig, 'logger'>;
  public readonly poolConfigPath: utils.Path;

  public readonly charset: string;
  public readonly collation: string;
  public readonly version?: semver.SemVer;
  public readonly schema: Schema;

  readonly #poolsByStatementKind = new Map<StatementKind, mariadb.Pool>();

  readonly #connectionsByMutation = new Map<
    core.MutationContext,
    mariadb.PoolConnection
  >();

  public constructor(
    public readonly gp: core.GraphQLPlatform,
    public readonly config: MariaDBConnectorConfig,
    public readonly configPath: utils.Path = utils.addPath(
      gp.configPath,
      'connector',
    ),
  ) {
    utils.assertPlainObject(config, configPath);

    super(config.on);

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

  public getPool(
    kind: StatementKind = StatementKind.DATA_MANIPULATION,
  ): mariadb.Pool {
    let pool = this.#poolsByStatementKind.get(kind);
    if (!pool) {
      utils.assertPlainObject(this.poolConfig, this.poolConfigPath);

      const logger: mariadb.PoolConfig['logger'] = {
        error: async (error) => {
          if (error instanceof mariadb.SqlError && error.fatal) {
            try {
              await this.emit(
                'error',
                Object.assign(error, { pool: StatementKind[kind] }),
              );
            } catch {
              // Silently ignore the error
            }
          }
        },
      };

      this.#poolsByStatementKind.set(
        kind,
        (pool = mariadb.createPool(
          kind === StatementKind.DATA_MANIPULATION
            ? {
                ...this.poolConfig,
                sessionVariables: {
                  ...this.poolConfig.sessionVariables,
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
                logger,
              }
            : {
                ...this.poolConfig,
                sessionVariables: {
                  ...this.poolConfig.sessionVariables,
                  max_statement_time: 60 * 60 * 12,
                },
                connectionLimit: 1,
                logger,
              },
        )),
      );
    }

    return pool;
  }

  public async disconnect(): Promise<void> {
    await Promise.all(
      Array.from(this.#poolsByStatementKind, async ([kind, pool]) => {
        try {
          await pool.end();
        } finally {
          this.#poolsByStatementKind.delete(kind);
        }
      }),
    );
  }

  public async withConnection<TResult = unknown>(
    task: (connection: mariadb.Connection) => Promise<TResult>,
    kind?: StatementKind,
  ): Promise<TResult> {
    const pool = this.getPool(kind);
    const connection = await pool.getConnection();
    try {
      return await task(connection);
    } finally {
      await connection.release();
    }
  }

  public async withConnectionInTransaction<TResult = unknown>(
    task: (connection: mariadb.Connection) => Promise<TResult>,
    kind?: StatementKind,
  ): Promise<TResult> {
    return this.withConnection(async (connection) => {
      try {
        await connection.beginTransaction();

        const result = await task(connection);

        await connection.commit();

        return result;
      } catch (error) {
        await connection.rollback();

        throw error;
      }
    }, kind);
  }

  public async executeQuery<TResult extends OkPacket | utils.PlainObject[]>(
    query: string | mariadb.QueryOptions,
    kind?: StatementKind,
  ): Promise<TResult> {
    return this.withConnection((connection) => connection.query(query), kind);
  }

  public async executeStatement<TResult extends OkPacket | utils.PlainObject[]>(
    statement: Statement,
    maybeConnection?: mariadb.Connection,
  ): Promise<TResult> {
    const startedAt = hrtime.bigint();

    let result: any;

    try {
      result = await (maybeConnection
        ? maybeConnection.query(statement)
        : this.executeQuery(statement, statement.kind));

      await this.emit('executed-statement', {
        statement,
        result,
        durationInSeconds:
          Math.round(Number(hrtime.bigint() - startedAt) / 10 ** 6) / 10 ** 3,
      });
    } catch (error) {
      if (error instanceof mariadb.SqlError) {
        const durationInSeconds =
          Math.round(Number(hrtime.bigint() - startedAt) / 10 ** 6) / 10 ** 3;

        Object.assign(error, { sql: statement.sql, durationInSeconds });

        await this.emit('failed-statement', {
          statement,
          error,
          durationInSeconds,
        });

        if (
          error.errno === 1062 &&
          (statement instanceof InsertStatement ||
            statement instanceof UpdateStatement)
        ) {
          const match = error.sqlMessage?.match(
            /Duplicate entry '(?<value>.+)' for key '(?<unique>.+)'/,
          );

          const uniqueIndex = match?.groups?.unique
            ? statement.table.uniqueIndexes.find(
                (uniqueIndex) => uniqueIndex.name === match?.groups?.unique,
              )
            : undefined;

          throw new core.DuplicateError(
            statement.table.node,
            statement instanceof InsertStatement
              ? core.ConnectorOperationKind.CREATE
              : core.ConnectorOperationKind.UPDATE,
            {
              uniqueConstraint: uniqueIndex?.uniqueConstraint,
              hint: match?.groups?.value,
              cause: error,
            },
          );
        }
      }

      throw error;
    }

    return result;
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
          table.create({ withoutForeignKeys: true }, connection),
        ),
      );

      // Then add their foreign-keys, if any
      await Promise.all(
        Array.from(this.schema.tablesByNode.values(), (table) =>
          table.addForeignKeys(undefined, connection),
        ),
      );
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
    const connection = await this.getPool(
      StatementKind.DATA_MANIPULATION,
    ).getConnection();

    await connection.beginTransaction();

    this.#connectionsByMutation.set(context, connection);
  }

  /**
   * Gets the current mutation's transactional connection
   */
  public getConnectionForMutation(
    context: core.MutationContext,
  ): mariadb.PoolConnection {
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
  ): Promise<number> {
    const table = this.schema.getTableByNode(node);
    const maybeConnection =
      context instanceof core.MutationContext
        ? this.getConnectionForMutation(context)
        : undefined;

    return table.count(context, statement, maybeConnection);
  }

  public async find<TValue extends core.NodeSelectedValue>(
    context: core.OperationContext,
    { node, ...statement }: core.ConnectorFindStatement<TValue>,
  ): Promise<TValue[]> {
    const table = this.schema.getTableByNode(node);
    const maybeConnection =
      context instanceof core.MutationContext
        ? this.getConnectionForMutation(context)
        : undefined;

    return table.find(context, statement, maybeConnection);
  }

  public async create(
    context: core.MutationContext,
    { node, ...statement }: core.ConnectorCreateStatement,
  ): Promise<core.NodeValue[]> {
    const table = this.schema.getTableByNode(node);
    const connection = this.getConnectionForMutation(context);

    return table.insert(context, statement, connection);
  }

  public async update(
    context: core.MutationContext,
    { node, ...statement }: core.ConnectorUpdateStatement,
  ): Promise<number> {
    const table = this.schema.getTableByNode(node);
    const connection = this.getConnectionForMutation(context);

    return table.update(context, statement, connection);
  }

  public async delete(
    context: core.MutationContext,
    { node, ...statement }: core.ConnectorDeleteStatement,
  ): Promise<number> {
    const table = this.schema.getTableByNode(node);
    const connection = this.getConnectionForMutation(context);

    return table.delete(context, statement, connection);
  }
}
