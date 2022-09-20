import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as mariadb from 'mariadb';
import * as rxjs from 'rxjs';
import * as semver from 'semver';
import {
  Schema,
  type ForeignKeyConfig,
  type LeafColumnConfig,
  type ReferenceColumnTreeConfig,
  type SchemaConfig,
  type TableConfig,
  type UniqueIndexConfig,
} from './schema.js';
import type { ExecutedStatement } from './statement.js';

export * from './schema.js';
export * from './statement.js';

export interface MariaDBConnectorConfig {
  charset?: string;
  collation?: string;
  version?: string;
  schema?: SchemaConfig;
  pool: mariadb.PoolConfig;
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
      foreignKey?: ForeignKeyConfig;
    };
    [core.ConnectorConfigOverrideKind.UNIQUE_CONSTRAINT]: {
      /**
       * Optional, customize the unique-constraint's index
       */
      index?: UniqueIndexConfig;
    };
  };

  public readonly charset: string;
  public readonly collation: string;
  public readonly version?: semver.SemVer;
  public readonly schema: Schema;
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

    this.charset = config.charset || 'utf8mb4';
    this.collation = config.collation || 'utf8mb4_unicode_520_ci';
    this.version =
      (config.version && semver.coerce(config.version)) || undefined;
    this.schema = new Schema(this);
  }

  @Memoize()
  public get pool(): mariadb.Pool {
    return mariadb.createPool({
      ...this.config.pool,
      charset: this.charset,
      collation: this.collation,
      dateStrings: true,
      bigIntAsNumber: false,
      decimalAsNumber: true,
      insertIdAsNumber: false,
      multipleStatements: false,
      timezone: 'Z',
      autoJsonMap: false,
      ...({
        bitOneIsBoolean: false,
      } as any),
    });
  }

  public async withConnection<TResult = unknown>(
    callback: (connection: mariadb.Connection) => Promise<TResult>,
  ): Promise<TResult> {
    const connection = await this.pool.getConnection();
    try {
      return await callback(connection);
    } finally {
      connection.release();
    }
  }

  public async withConnectionInTransaction<TResult = unknown>(
    callback: (connection: mariadb.Connection) => Promise<TResult>,
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
    });
  }

  public async reset(): Promise<void> {
    await this.withConnectionInTransaction(async (connection) => {
      // Drop the schema, if any
      await this.schema.drop({ ifExists: true }, connection);

      // Then create a new one
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
    });
  }

  public async preMutation(context: core.MutationContext): Promise<void> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

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

    return table.count(statement, undefined, maybeConnection);
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

    return table.find(statement, undefined, maybeConnection);
  }

  public async create(
    statement: core.ConnectorCreateStatement,
    context: core.MutationContext,
  ): Promise<core.NodeValue[]> {
    const table = this.schema.getTableByNode(statement.node);

    return table.insert(
      statement,
      undefined,
      this.#connectionsByContext.get(context),
    );
  }

  public async update(
    statement: core.ConnectorUpdateStatement,
    context: core.MutationContext,
  ): Promise<number> {
    const table = this.schema.getTableByNode(statement.node);

    throw new Error('Method not implemented.');
  }

  public async delete(
    statement: core.ConnectorDeleteStatement,
    context: core.MutationContext,
  ): Promise<number> {
    const table = this.schema.getTableByNode(statement.node);

    throw new Error('Method not implemented.');
  }
}
