import {
  ConnectorCountOperationArgs,
  ConnectorCreateOperationArgs,
  ConnectorDeleteOperationArgs,
  ConnectorFindOperationArgs,
  ConnectorInterface,
  ConnectorOperationParams as CoreConnectorOperationParams,
  ConnectorUpdateOperationArgs,
  OperationContext as CoreOperationContext,
  OperationEventKind,
  OperationEventMap,
} from '@prismamedia/graphql-platform-core';
import { GraphQLOperationType, Maybe, MaybeArray, POJO } from '@prismamedia/graphql-platform-utils';
import EventEmitter from '@prismamedia/ts-async-event-emitter';
import * as mysql from 'mysql';
import { Memoize } from 'typescript-memoize';
import { promisify } from 'util';
import { BaseContext, GraphQLPlatform } from '../graphql-platform';
import { Database } from './connector/database';
import { ConnectorRequest } from './connector/request';

export * from './connector/database';
export * from './connector/request';

type ConnectorOperationContext = {
  // The raw MySQL connection
  connection: mysql.PoolConnection;

  // Either the connection has been started in this operation (= managed) or has been provided by the context (= not managed)
  isConnectionManaged: boolean;

  // Either the connection is currently into a transaction or not
  transaction: boolean;

  // Either the transaction has been started in this operation (= managed) or has been provided by the context (= not managed)
  isTransactionManaged: boolean;
};

export interface OperationContext extends CoreOperationContext, ConnectorOperationContext {}

export enum ConnectorEventKind {
  StartTransaction = 'START_TRANSACTION',
  RollbackTransaction = 'ROLLBACK_TRANSACTION',
  CommitTransaction = 'COMMIT_TRANSACTION',
  PreQuery = 'PRE_QUERY',
}

export type ConnectorEventMap = {
  [ConnectorEventKind.StartTransaction]: Readonly<Pick<mysql.Connection, 'threadId'>>;
  [ConnectorEventKind.RollbackTransaction]: Readonly<Pick<mysql.Connection, 'threadId'>>;
  [ConnectorEventKind.CommitTransaction]: Readonly<Pick<mysql.Connection, 'threadId'>>;
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

type ConnectorOperationParams<TArgs extends POJO> = CoreConnectorOperationParams<TArgs, BaseContext, OperationContext>;

export class Connector extends EventEmitter<ConnectorEventMap>
  implements ConnectorInterface<BaseContext, OperationContext> {
  protected pool?: mysql.Pool;

  public constructor(readonly config: Maybe<ConnectorConfig>, readonly graphqlPlatform: GraphQLPlatform) {
    super();

    // Handle connection & transaction
    this.graphqlPlatform.getResourceSet().forEach(resource =>
      resource.onConfig({
        [OperationEventKind.PreOperation]: async ({
          operation: { type },
          context,
          operationContext: coreOperationContext,
        }: OperationEventMap<any, {}, BaseContext, CoreOperationContext>[OperationEventKind.PreOperation]) => {
          /**
           * If a connection has been provided in the regular "context", we use it.
           * Otherwise, we wait for one from the pool
           */
          const connectorOperationContext: ConnectorOperationContext = {
            ...(context.connectorRequest.connection
              ? {
                  connection: context.connectorRequest.connection,
                  isConnectionManaged: false,
                  transaction: context.connectorRequest.transaction === true,
                  isTransactionManaged: false,
                }
              : {
                  connection: await this.getConnection(),
                  isConnectionManaged: true,
                  transaction: false,
                  isTransactionManaged: false,
                }),
          };

          const operationContext: OperationContext = Object.assign(coreOperationContext, connectorOperationContext);

          if (type === GraphQLOperationType.Mutation) {
            if (!operationContext.transaction) {
              await Promise.all([
                this.emit(ConnectorEventKind.StartTransaction, { threadId: operationContext.connection.threadId }),
                promisify(operationContext.connection.beginTransaction.bind(operationContext.connection))(),
              ]);

              operationContext.transaction = true;
              operationContext.isTransactionManaged = true;
            }

            /**
             * In a mutation, we know that the operations will be executed serially,
             * so the next operation will be executed after the "PostOperation" event of this one.
             *
             * We use this behavior to share the connection in the regular "context" in order to
             * be used everywhere, especially in the "API binding" when we want to run queries
             * into the same transaction.
             */
            if (operationContext.isConnectionManaged) {
              Object.assign(context.connectorRequest, {
                connection: operationContext.connection,
                transaction: operationContext.transaction,
              });
            }
          }
        },

        [OperationEventKind.PostOperationSuccess]: async ({
          operation: { type },
          operationContext,
        }: OperationEventMap<any, {}, BaseContext, OperationContext>[OperationEventKind.PostOperationSuccess]) => {
          if (type === GraphQLOperationType.Mutation && operationContext.isTransactionManaged) {
            await Promise.all([
              this.emit(ConnectorEventKind.CommitTransaction, { threadId: operationContext.connection.threadId }),
              promisify(operationContext.connection.commit.bind(operationContext.connection))(),
            ]);

            operationContext.inTransaction = false;
            operationContext.isTransactionManaged = false;
          }
        },

        [OperationEventKind.PostOperationError]: async ({
          operation: { type },
          operationContext,
        }: OperationEventMap<any, {}, BaseContext, OperationContext>[OperationEventKind.PostOperationError]) => {
          if (type === GraphQLOperationType.Mutation && operationContext.isTransactionManaged) {
            await Promise.all([
              this.emit(ConnectorEventKind.RollbackTransaction, { threadId: operationContext.connection.threadId }),
              promisify(operationContext.connection.rollback.bind(operationContext.connection))(),
            ]);

            operationContext.inTransaction = false;
            operationContext.isTransactionManaged = false;
          }
        },

        [OperationEventKind.PostOperation]: async ({
          context,
          operationContext,
        }: OperationEventMap<any, {}, BaseContext, OperationContext>[OperationEventKind.PostOperation]) => {
          if (operationContext.isConnectionManaged) {
            operationContext.connection.release();

            // We clean what we did in the regular "context"
            delete context.connectorRequest.connection;
            delete context.connectorRequest.transaction;
          }
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
    query: MaybeArray<mysql.QueryOptions | mysql.QueryOptions['sql']>,
    maybeConnection?: Maybe<mysql.Connection | BaseContext>,
  ): Promise<QueryResult> {
    const connection: mysql.Connection | undefined = maybeConnection
      ? 'connectorRequest' in maybeConnection
        ? maybeConnection.connectorRequest.connection
        : maybeConnection
      : undefined;

    return connection
      ? Array.isArray(query)
        ? // As we use only one connection, even if they are thrown concurrently, they are executed serially
          Promise.all(query.map(async query => this.query(query, connection)))
        : new Promise(async (resolve, reject) => {
            const parsedQuery: mysql.QueryOptions = typeof query === 'string' ? { sql: query } : query;

            await this.emit(ConnectorEventKind.PreQuery, {
              threadId: connection.threadId,
              ...parsedQuery,
            });

            connection.query(query, async (error, rows) => (error ? reject(error) : resolve(rows)));
          })
      : this.withConnection(async connection => this.query(query, connection));
  }

  public newRequest(): ConnectorRequest {
    return new ConnectorRequest(this);
  }

  public async find({
    resource,
    operationContext: { connection },
    ...params
  }: ConnectorOperationParams<ConnectorFindOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Find')
      .execute(Object.freeze({ connection, ...params }));
  }

  public async count({
    resource,
    operationContext: { connection },
    ...params
  }: ConnectorOperationParams<ConnectorCountOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Count')
      .execute(Object.freeze({ connection, ...params }));
  }

  public async create({
    resource,
    operationContext: { connection },
    ...params
  }: ConnectorOperationParams<ConnectorCreateOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Create')
      .execute(Object.freeze({ connection, ...params }));
  }

  public async update({
    resource,
    operationContext: { connection },
    ...params
  }: ConnectorOperationParams<ConnectorUpdateOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Update')
      .execute(Object.freeze({ connection, ...params }));
  }

  public async delete({
    resource,
    operationContext: { connection },
    ...params
  }: ConnectorOperationParams<ConnectorDeleteOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Delete')
      .execute(Object.freeze({ connection, ...params }));
  }
}
