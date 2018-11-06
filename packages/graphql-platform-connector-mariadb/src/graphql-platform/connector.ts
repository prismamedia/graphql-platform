import {
  ConnectorCountOperationArgs,
  ConnectorCreateOperationArgs,
  ConnectorDeleteOperationArgs,
  ConnectorFindOperationArgs,
  ConnectorInterface,
  ConnectorOperationParams as CoreConnectorOperationParams,
  ConnectorUpdateOperationArgs,
  OperationContext as CoreOperationContext,
  ResourceEventKind,
  ResourceEventMap,
} from '@prismamedia/graphql-platform-core';
import { GraphQLOperationType, Maybe, POJO } from '@prismamedia/graphql-platform-utils';
import EventEmitter from '@prismamedia/ts-async-event-emitter';
import * as mysql from 'mysql';
import { Memoize } from 'typescript-memoize';
import { promisify } from 'util';
import { BaseContext, GraphQLPlatform } from '../graphql-platform';
import { Database } from './connector/database';
import { ConnectorRequest } from './connector/request';

export * from './connector/database';
export * from './connector/request';

export enum ConnectorEventKind {
  PreQuery = 'PRE_QUERY',
}

export type ConnectorEventMap = {
  [ConnectorEventKind.PreQuery]: Readonly<Pick<mysql.Connection, 'threadId'> & mysql.QueryOptions>;
};

export type ConnectorConfig = Omit<
  mysql.PoolConfig,
  | 'bigNumberStrings'
  | 'charset'
  | 'dateStrings'
  | 'debug'
  | 'flags'
  | 'insecureAuth'
  | 'multipleStatements'
  | 'queryFormat'
  | 'stringifyObjects'
  | 'supportBigNumbers'
  | 'timezone'
  | 'trace'
  | 'typeCast'
> & {
  /**
   * If you need to set session variables on the connection before it gets used, you're able to do it like:
   * onConnect: connection => connection.query('SET wait_timeout=1; SET max_statement_time=1;')
   */
  onConnect?: Maybe<(connection: mysql.PoolConnection) => void>;
};

export type QueryResult =
  | POJO[]
  | {
      affectedRows: Maybe<number>;
      changedRows: Maybe<number>;
      insertId: Maybe<number>;
    };

export interface OperationContext extends CoreOperationContext {
  connection: mysql.PoolConnection;
  inTransaction: boolean;
}

type ConnectorOperationParams<TArgs extends POJO> = CoreConnectorOperationParams<TArgs, BaseContext, OperationContext>;

export class Connector extends EventEmitter<ConnectorEventMap>
  implements ConnectorInterface<BaseContext, OperationContext> {
  protected pool?: mysql.Pool;

  public constructor(readonly config: Maybe<ConnectorConfig>, readonly graphqlPlatform: GraphQLPlatform) {
    super();

    // Handle connection & transaction
    this.graphqlPlatform.getResourceSet().forEach(resource =>
      resource.onConfig({
        [ResourceEventKind.PreOperation]: async ({
          operationContext,
          operation: { type },
        }: ResourceEventMap<BaseContext, CoreOperationContext>[ResourceEventKind.PreOperation]) => {
          const connection = await this.getConnection();

          operationContext.connection = connection;

          if (type === GraphQLOperationType.Mutation) {
            await promisify(connection.beginTransaction.bind(connection))();
            operationContext.inTransaction = true;
          } else {
            operationContext.inTransaction = false;
          }
        },

        [ResourceEventKind.PostOperationSuccess]: async ({
          operationContext,
          operation: { type },
        }: ResourceEventMap<BaseContext, OperationContext>[ResourceEventKind.PostOperationSuccess]) => {
          const { connection } = operationContext;

          if (type === GraphQLOperationType.Mutation) {
            await promisify(connection.commit.bind(connection))();
            operationContext.inTransaction = false;
          }
        },

        [ResourceEventKind.PostOperationError]: async ({
          operationContext,
          operation: { type },
        }: ResourceEventMap<BaseContext, OperationContext>[ResourceEventKind.PostOperationError]) => {
          const { connection } = operationContext;

          if (type === GraphQLOperationType.Mutation) {
            await promisify(connection.rollback.bind(connection))();
            operationContext.inTransaction = false;
          }
        },

        [ResourceEventKind.PostOperation]: async ({
          operationContext,
        }: ResourceEventMap<BaseContext, OperationContext>[ResourceEventKind.PostOperation]) => {
          operationContext.connection.release();
          delete operationContext.connection;
          delete operationContext.inTransaction;
        },
      }),
    );
  }

  @Memoize()
  public getCharset(): string {
    return 'utf8mb4';
  }

  @Memoize()
  public getCollation(): string {
    return 'utf8mb4_unicode_520_ci';
  }

  @Memoize()
  public getDatabase(): Database {
    return new Database(this);
  }

  protected getPool(): mysql.Pool {
    if (this.pool) {
      return this.pool;
    }

    if (!this.config) {
      throw new Error(`You have to provide the connector's configuration.`);
    }

    const { onConnect, ...poolConfig } = this.config;

    return (this.pool = mysql
      .createPool({
        ...poolConfig,
        charset: this.getCollation(),
        debug: false,
        multipleStatements: false,
        supportBigNumbers: true,
        timezone: 'Z',
        waitForConnections: true,
      })
      .on('connection', connection => {
        // We ensure the good charset to be used
        connection.query(`SET NAMES ${this.getCharset()} COLLATE ${this.getCollation()};`);

        // We let the user configure the connection
        onConnect && onConnect(connection);
      }));
  }

  public async closePool(): Promise<void> {
    if (this.pool) {
      await promisify(this.pool.end.bind(this.pool))();
      delete this.pool;
    }
  }

  public async resetPool(): Promise<void> {
    await this.closePool();
    this.getPool();
  }

  protected async getConnection(): Promise<mysql.PoolConnection> {
    const pool = this.getPool();

    return promisify(pool.getConnection.bind(pool))();
  }

  /** Ensures the connection is released at the end of the task. */
  public async withConnection<R>(task: (connection: mysql.Connection) => Promise<R>): Promise<R> {
    let result: R;

    const connection = await this.getConnection();
    try {
      result = await task(connection);
    } finally {
      connection.release();
    }

    return result;
  }

  public async query(
    query: mysql.QueryOptions | mysql.QueryOptions['sql'],
    connection?: Maybe<mysql.Connection>,
  ): Promise<QueryResult> {
    return connection
      ? new Promise(async (resolve, reject) => {
          const parsedQuery: mysql.QueryOptions = typeof query === 'string' ? { sql: query } : query;

          await this.emit(ConnectorEventKind.PreQuery, {
            threadId: connection.threadId,
            ...parsedQuery,
          });

          connection.query(query, async (error, rows) => (error ? reject(error) : resolve(rows)));
        })
      : this.withConnection(async connection => this.query(query, connection));
  }

  public async querySerial(
    queries: (mysql.QueryOptions | mysql.QueryOptions['sql'])[],
    connection?: Maybe<mysql.Connection>,
  ): Promise<QueryResult[]> {
    return connection
      ? Promise.all(queries.map(async query => this.query(query, connection)))
      : this.withConnection(async connection => this.querySerial(queries, connection));
  }

  public newRequest(): ConnectorRequest {
    return new ConnectorRequest(this);
  }

  public async find({ resource, ...params }: ConnectorOperationParams<ConnectorFindOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Find')
      .execute(params);
  }

  public async count({ resource, ...params }: ConnectorOperationParams<ConnectorCountOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Count')
      .execute(params);
  }

  public async create({ resource, ...params }: ConnectorOperationParams<ConnectorCreateOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Create')
      .execute(params);
  }

  public async update({ resource, ...params }: ConnectorOperationParams<ConnectorUpdateOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Update')
      .execute(params);
  }

  public async delete({ resource, ...params }: ConnectorOperationParams<ConnectorDeleteOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Delete')
      .execute(params);
  }
}
