import {
  AnyGraphQLPlatform,
  ConnectorCountOperationArgs,
  ConnectorCreateOperationArgs,
  ConnectorDeleteOperationArgs,
  ConnectorFindOperationArgs,
  ConnectorInterface,
  ConnectorOperationParams as CoreConnectorOperationParams,
  ConnectorUpdateOperationArgs,
  CustomContext,
  OperationEventKind,
} from '@prismamedia/graphql-platform-core';
import { GraphQLOperationType, Maybe, MaybeArray, POJO } from '@prismamedia/graphql-platform-utils';
import EventEmitter from '@prismamedia/ts-async-event-emitter';
import * as mysql from 'mysql';
import { Memoize } from 'typescript-memoize';
import { promisify } from 'util';
import { BaseContext } from '../graphql-platform';
import { Database } from './connector/database';
import { OperationEvent } from './connector/database/operation';
import { ConnectorRequest } from './connector/request';

export * from './connector/database';
export * from './connector/request';

export enum ConnectorEventKind {
  PreStartTransaction = 'PRE_START_TRANSACTION',
  PreRollbackTransaction = 'PRE_ROLLBACK_TRANSACTION',
  PreCommitTransaction = 'PRE_COMMIT_TRANSACTION',
  PreQuery = 'PRE_QUERY',
}

export type ConnectorEventMap = {
  [ConnectorEventKind.PreStartTransaction]: Readonly<Pick<mysql.Connection, 'threadId'>>;
  [ConnectorEventKind.PreRollbackTransaction]: Readonly<Pick<mysql.Connection, 'threadId'>>;
  [ConnectorEventKind.PreCommitTransaction]: Readonly<Pick<mysql.Connection, 'threadId'>>;
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

export type ConnectorOperationParams<
  TArgs extends POJO,
  TCustomContext extends CustomContext = {}
> = CoreConnectorOperationParams<TArgs, TCustomContext, BaseContext>;

export class Connector<TCustomContext extends CustomContext = {}> extends EventEmitter<ConnectorEventMap>
  implements ConnectorInterface<TCustomContext, BaseContext> {
  protected pool?: mysql.Pool;

  public constructor(readonly config: Maybe<ConnectorConfig>, readonly gp: AnyGraphQLPlatform) {
    super();

    // Handle connection & transaction
    this.gp.getResourceSet().forEach(resource =>
      resource.onConfig({
        [OperationEventKind.PreOperation]: async (event: OperationEvent<any, TCustomContext>) => {
          const {
            operation: { type },
            context: { operationEventDataMap, connectorRequest, logger },
          } = event;

          const eventData = operationEventDataMap.get(event);

          if (type === GraphQLOperationType.Mutation && !connectorRequest.connection) {
            connectorRequest.connection = await this.getConnection();

            try {
              await this.emit(ConnectorEventKind.PreStartTransaction, {
                threadId: connectorRequest.connection.threadId,
              });
            } catch (error) {
              logger && logger.error(logger);
            }

            await promisify(connectorRequest.connection.beginTransaction.bind(connectorRequest.connection))();

            if (eventData) {
              eventData.createdConnection = true;
            }
          }
        },
        [OperationEventKind.PostOperationSuccess]: async (event: OperationEvent<any, TCustomContext>) => {
          const {
            operation: { type },
            context: { operationEventDataMap, connectorRequest, logger },
          } = event;

          const eventData = operationEventDataMap.get(event);

          if (
            type === GraphQLOperationType.Mutation &&
            connectorRequest.connection &&
            eventData &&
            eventData.createdConnection === true
          ) {
            try {
              await this.emit(ConnectorEventKind.PreCommitTransaction, {
                threadId: connectorRequest.connection.threadId,
              });
            } catch (error) {
              logger && logger.error(logger);
            }

            await promisify(connectorRequest.connection.commit.bind(connectorRequest.connection))();
          }
        },
        [OperationEventKind.PostOperationError]: async (event: OperationEvent<any, TCustomContext>) => {
          const {
            operation: { type },
            context: { operationEventDataMap, connectorRequest, logger },
          } = event;

          const eventData = operationEventDataMap.get(event);

          if (
            type === GraphQLOperationType.Mutation &&
            connectorRequest.connection &&
            eventData &&
            eventData.createdConnection === true
          ) {
            try {
              await this.emit(ConnectorEventKind.PreRollbackTransaction, {
                threadId: connectorRequest.connection.threadId,
              });
            } catch (error) {
              logger && logger.error(logger);
            }

            await promisify(connectorRequest.connection.rollback.bind(connectorRequest.connection))();
          }
        },
        [OperationEventKind.PostOperation]: async (event: OperationEvent<any, TCustomContext>) => {
          const {
            operation: { type },
            context: { operationEventDataMap, connectorRequest },
          } = event;

          const eventData = operationEventDataMap.get(event);

          if (
            type === GraphQLOperationType.Mutation &&
            connectorRequest.connection &&
            eventData &&
            eventData.createdConnection === true
          ) {
            connectorRequest.connection.release();

            delete connectorRequest.connection;
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
        dateStrings: false,
      })
      .on('connection', connection => {
        // We ensure the good charset and the good timezone to be used
        connection.query(`SET NAMES ${this.getCharset()} COLLATE ${this.getCollation()}; SET time_zone = 'UTC';`);

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

  public async find({ resource, ...params }: ConnectorOperationParams<ConnectorFindOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Find')
      .execute(Object.freeze(params));
  }

  public async count({ resource, ...params }: ConnectorOperationParams<ConnectorCountOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Count')
      .execute(Object.freeze(params));
  }

  public async create({ resource, ...params }: ConnectorOperationParams<ConnectorCreateOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Create')
      .execute(Object.freeze(params));
  }

  public async update({ resource, ...params }: ConnectorOperationParams<ConnectorUpdateOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Update')
      .execute(Object.freeze(params));
  }

  public async delete({ resource, ...params }: ConnectorOperationParams<ConnectorDeleteOperationArgs>) {
    return this.getDatabase()
      .getTable(resource)
      .getOperation('Delete')
      .execute(Object.freeze(params));
  }
}
