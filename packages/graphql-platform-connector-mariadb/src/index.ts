import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import * as mariadb from 'mariadb';
import { hrtime } from 'node:process';
import * as rxjs from 'rxjs';
import * as semver from 'semver';
import {
  Schema,
  type ForeignKeyIndexConfig,
  type LeafColumnConfig,
  type ReferenceColumnTreeConfig,
  type SchemaConfig,
  type TableConfig,
  type UniqueIndexConfig,
} from './schema.js';
import { ExecutedStatement, Statement, StatementKind } from './statement.js';

export * from './escaping.js';
export * from './schema.js';
export * from './statement.js';

/**
 * @see https://mariadb.com/kb/en/ok_packet/
 */
export type OkPacket = {
  affectedRows: number;
  insertId: BigInt;
  warningStatus: number;
};

export interface MariaDBConnectorConfig {
  charset?: string;
  collation?: string;
  version?: string;
  schema?: SchemaConfig;
  pool?: mariadb.PoolConfig;
}

/**
 * @see https://mariadb.com/kb/en/nodejs-connector/
 */
export class MariaDBConnector implements core.ConnectorInterface {
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

  public readonly poolConfig?: mariadb.PoolConfig;
  public readonly poolConfigPath: utils.Path;
  public readonly databasePoolConfig?: string;
  public readonly databasePoolConfigPath: utils.Path;

  public readonly charset: string;
  public readonly collation: string;
  public readonly version?: semver.SemVer;
  public readonly schema: Schema;

  readonly #poolsByStatementKind = new Map<StatementKind, mariadb.Pool>();

  readonly #connectionsByContext = new Map<
    core.MutationContext,
    mariadb.PoolConnection
  >();

  /**
   * An Observable of the executed statements
   */
  public readonly executedStatements = new rxjs.Subject<ExecutedStatement>();

  public constructor(
    public readonly gp: core.GraphQLPlatform,
    public readonly config: MariaDBConnectorConfig,
    public readonly configPath: utils.Path = utils.addPath(
      gp.configPath,
      'connector',
    ),
  ) {
    utils.assertPlainObjectConfig(config, configPath);

    // pool-config
    {
      this.poolConfig = config.pool || undefined;
      this.poolConfigPath = utils.addPath(configPath, 'pool');

      utils.assertNillablePlainObjectConfig(
        this.poolConfig,
        this.poolConfigPath,
      );

      // database-pool-config
      {
        this.databasePoolConfig = this.poolConfig?.database || undefined;
        this.databasePoolConfigPath = utils.addPath(
          this.poolConfigPath,
          'database',
        );

        if (
          this.databasePoolConfig !== undefined &&
          typeof this.databasePoolConfig !== 'string'
        ) {
          throw new utils.UnexpectedConfigError(
            `a non-empty string`,
            this.databasePoolConfig,
            { path: this.databasePoolConfigPath },
          );
        }
      }
    }

    this.charset = config.charset || 'utf8mb4';
    this.collation = config.collation || 'utf8mb4_unicode_520_ci';
    this.version =
      (config.version && semver.coerce(config.version)) || undefined;
    this.schema = new Schema(this);
  }

  public getPool(
    kind: StatementKind = StatementKind.MANIPULATION,
  ): mariadb.Pool {
    let pool = this.#poolsByStatementKind.get(kind);
    if (!pool) {
      utils.assertPlainObjectConfig(this.poolConfig, this.poolConfigPath);

      this.#poolsByStatementKind.set(
        kind,
        (pool = mariadb.createPool(
          kind === StatementKind.DEFINITION
            ? { ...this.poolConfig, connectionLimit: 1 }
            : {
                ...this.poolConfig,
                database: this.schema.name,
                charset: this.charset,
                collation: this.collation,
                dateStrings: true,
                bigIntAsNumber: false,
                decimalAsNumber: true,
                insertIdAsNumber: false,
                multipleStatements: false,
                timezone: 'Z',
                autoJsonMap: false,
                ...({ bitOneIsBoolean: false } as any),
              },
        )),
      );
    }

    return pool;
  }

  public async withConnection<TResult = unknown>(
    callback: (connection: mariadb.Connection) => Promise<TResult>,
    kind?: StatementKind,
  ): Promise<TResult> {
    const connection = await this.getPool(kind).getConnection();
    try {
      return await callback(connection);
    } finally {
      connection.release();
    }
  }

  public async withConnectionInTransaction<TResult = unknown>(
    callback: (connection: mariadb.Connection) => Promise<TResult>,
    kind?: StatementKind,
  ): Promise<TResult> {
    return this.withConnection(async (connection) => {
      let result: TResult;

      try {
        await connection.beginTransaction();

        result = await callback(connection);

        await connection.commit();
      } catch (error) {
        await connection.rollback();

        throw error;
      }

      return result;
    }, kind);
  }

  public async executeStatement<TResult extends OkPacket | utils.PlainObject[]>(
    statement: Statement,
    maybeConnection?: mariadb.Connection,
  ): Promise<TResult> {
    const startedAt = hrtime.bigint();

    const result = await (maybeConnection
      ? maybeConnection.query(statement)
      : this.withConnection(
          (connection) => connection.query(statement),
          statement.kind,
        ));

    this.executedStatements.next({
      statement,
      result,
      took: Math.round(Number(hrtime.bigint() - startedAt) / 10 ** 6) / 10 ** 3,
    });

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
    }, StatementKind.DEFINITION);
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
      await Promise.all(
        Array.from(this.#poolsByStatementKind).map(async ([kind, pool]) => {
          try {
            await pool.end();
          } finally {
            this.#poolsByStatementKind.delete(kind);
          }
        }),
      );
    }
  }

  public async preMutation(context: core.MutationContext): Promise<void> {
    const connection = await this.getPool(
      StatementKind.MANIPULATION,
    ).getConnection();

    try {
      await connection.beginTransaction();
    } catch (error) {
      await connection.release();

      throw error;
    }

    this.#connectionsByContext.set(context, connection);
  }

  public async postSuccessfulMutation(
    context: core.MutationContext,
  ): Promise<void> {
    await this.#connectionsByContext.get(context)!.commit();
  }

  public async postFailedMutation(
    context: core.MutationContext,
  ): Promise<void> {
    await this.#connectionsByContext.get(context)!.rollback();
  }

  public async postMutation(context: core.MutationContext): Promise<void> {
    try {
      await this.#connectionsByContext.get(context)!.release();
    } finally {
      this.#connectionsByContext.delete(context);
    }
  }

  public async count(
    statement: core.ConnectorCountStatement,
    context: core.OperationContext,
  ): Promise<number> {
    const table = this.schema.getTableByNode(statement.node);
    const maybeConnection =
      context instanceof core.MutationContext
        ? this.#connectionsByContext.get(context)
        : undefined;

    return table.count(statement, context, maybeConnection);
  }

  public async find(
    statement: core.ConnectorFindStatement,
    context: core.OperationContext,
  ): Promise<core.NodeSelectedValue[]> {
    const table = this.schema.getTableByNode(statement.node);
    const maybeConnection =
      context instanceof core.MutationContext
        ? this.#connectionsByContext.get(context)
        : undefined;

    return table.find(statement, context, maybeConnection);
  }

  public async create(
    statement: core.ConnectorCreateStatement,
    context: core.MutationContext,
  ): Promise<core.NodeValue[]> {
    const table = this.schema.getTableByNode(statement.node);
    const connection = this.#connectionsByContext.get(context)!;

    return table.insert(statement, context, connection);
  }

  public async update(
    statement: core.ConnectorUpdateStatement,
    context: core.MutationContext,
  ): Promise<number> {
    const table = this.schema.getTableByNode(statement.node);
    const connection = this.#connectionsByContext.get(context)!;

    return table.update(statement, context, connection);
  }

  public async delete(
    statement: core.ConnectorDeleteStatement,
    context: core.MutationContext,
  ): Promise<number> {
    const table = this.schema.getTableByNode(statement.node);
    const connection = this.#connectionsByContext.get(context)!;

    return table.delete(statement, context, connection);
  }
}
