import type { EventListener } from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import * as R from 'remeda';
import type { JsonObject } from 'type-fest';
import {
  MariaDBSubscription,
  msTimestampType,
  type MariaDBSubscriptionEvents,
} from './broker/subscription.js';
import { escapeIdentifier, escapeStringValue } from './escaping.js';
import type { MariaDBConnector, OkPacket } from './index.js';

export {
  MariaDBSubscription,
  type MariaDBSubscriptionEvents,
} from './broker/subscription.js';

export interface MariaDBBrokerOptions<TRequestContext extends object = any> {
  enabled?: utils.OptionalFlag;
  requestsTable?: string;
  changesByRequestTable?: string;

  /**
   * The number of seconds to wait between pulling changes, after the subscription became idle.
   *
   * @default 5
   */
  pullInterval?: number;

  /**
   * The number of seconds to keep the changes in the database.
   *
   * @default 3600 * 24
   */
  retention?: number;

  /**
   * The number of changes to process in a single batch.
   *
   * @default 100
   */
  batchSize?: number;

  /**
   * Optional, a function to serialize the request-context as a JSON object
   */
  serializeRequestContext?: (requestContext: TRequestContext) => JsonObject;

  /**
   * Optional, a function to unserialize the request-context from a JSON object
   */
  unserializeRequestContext?: (requestContext: JsonObject) => TRequestContext;
}

export class MariaDBBroker<TRequestContext extends object = any>
  implements core.BrokerInterface
{
  public readonly requestsTableName: string;
  public readonly changesByRequestTableName: string;

  public readonly pullInterval: number;
  public readonly retention: number;
  public readonly batchSize: number;

  readonly #subscriptions = new Map<
    core.ChangesSubscriptionStream,
    MariaDBSubscription
  >();

  public constructor(
    public readonly connector: MariaDBConnector<TRequestContext>,
    public readonly options?: MariaDBBrokerOptions<TRequestContext>,
  ) {
    this.requestsTableName = options?.requestsTable ?? '_gp_requests';
    this.changesByRequestTableName =
      options?.changesByRequestTable ?? '_gp_changes_by_request';

    this.pullInterval = Math.max(1, options?.pullInterval ?? 5);
    this.retention = Math.max(1, options?.retention ?? 3600 * 24);
    this.batchSize = Math.max(1, options?.batchSize ?? 100);
  }

  public async setup(connection?: mariadb.Connection): Promise<void> {
    const queries = [
      `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.requestsTableName}`)} (
        ${escapeIdentifier('id')} BIGINT UNSIGNED AUTO_INCREMENT NOT NULL PRIMARY KEY,
        ${escapeIdentifier('context')} JSON NOT NULL,
        ${escapeIdentifier('changes')} JSON NOT NULL,
        ${escapeIdentifier('committedAt')} ${msTimestampType.definition} NOT NULL,
        INDEX idx_id_committedAt (${['id', 'committedAt'].map(escapeIdentifier).join()})
      )`,
      `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.changesByRequestTableName}`)} (
        ${escapeIdentifier('requestId')} BIGINT UNSIGNED NOT NULL,
        ${escapeIdentifier('id')} BIGINT UNSIGNED NOT NULL,
        ${escapeIdentifier('node')} VARCHAR(255) NOT NULL,
        ${escapeIdentifier('kind')} ENUM(${utils.mutationTypes.map(escapeStringValue).join(',')}) NOT NULL,
        ${escapeIdentifier('oldValue')} JSON NULL,
        ${escapeIdentifier('newValue')} JSON NULL,
        ${escapeIdentifier('executedAt')} ${msTimestampType.definition} NOT NULL,
        ${escapeIdentifier('committedAt')} ${msTimestampType.definition} NOT NULL,
        PRIMARY KEY (${escapeIdentifier('requestId')}, ${escapeIdentifier('id')}),
        FOREIGN KEY ${escapeIdentifier(`fk_${this.changesByRequestTableName}_requestId`)} (${escapeIdentifier('requestId')}) REFERENCES ${escapeIdentifier(`${this.connector.schema}.${this.requestsTableName}`)}(${escapeIdentifier('id')}) ON DELETE CASCADE
      )`,
      `CREATE EVENT IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.requestsTableName}_ttl`)}
        ON SCHEDULE EVERY ${this.retention} SECOND
        DO
          DELETE FROM ${escapeIdentifier(`${this.connector.schema}.${this.requestsTableName}`)}
          WHERE ${escapeIdentifier('committedAt')} < NOW() - INTERVAL ${this.retention} SECOND;
      `,
      `SET GLOBAL event_scheduler=ON`,
    ];

    if (connection) {
      for (const query of queries) {
        await connection.query(query);
      }
    } else {
      await this.connector.withConnection(async (connection) => {
        for (const query of queries) {
          await connection.query(query);
        }
      });
    }
  }

  public async publish(changes: core.MutationContextChanges): Promise<void> {
    assert(changes.committedAt, 'The changes must have been committed');

    await using connection = await this.connector.getConnection();

    const { insertId: requestId } = await connection.query<OkPacket>(
      `INSERT INTO ${escapeIdentifier(this.requestsTableName)} (${['context', 'changes', 'committedAt'].map(escapeIdentifier).join(',')}) VALUES (?, ?, ?)`,
      [
        this.options?.serializeRequestContext
          ? this.options.serializeRequestContext(changes.requestContext)
          : changes.requestContext,
        Object.fromEntries(
          changes.changesByNode.values().map((changes) => [
            changes.node.name,
            R.pipe(
              utils.mutationTypes,
              R.filter((type) => changes[type].size > 0),
              R.mapToObj((type) => [type, changes[type].size]),
            ),
          ]),
        ),
        msTimestampType.format(changes.committedAt),
      ],
    );

    await Promise.all(
      Array.from(
        changes,
        ({ node, kind, oldValue, newValue, executedAt, committedAt }, id) => {
          assert(committedAt, 'The change must have been committed');

          return connection.execute(
            `INSERT INTO ${escapeIdentifier(this.changesByRequestTableName)} (${['requestId', 'id', 'node', 'kind', 'oldValue', 'newValue', 'executedAt', 'committedAt'].map(escapeIdentifier).join(',')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              requestId,
              id + 1,
              node.name,
              kind,
              oldValue ? node.selection.serialize(oldValue) : null,
              newValue ? node.selection.serialize(newValue) : null,
              msTimestampType.format(executedAt),
              msTimestampType.format(committedAt),
            ],
          );
        },
      ),
    );
  }

  public async subscribe(
    subscription: core.ChangesSubscriptionStream,
  ): Promise<core.NodeChangeSubscriptionInterface> {
    const queue = new MariaDBSubscription(this, subscription);
    this.#subscriptions.set(subscription, queue);

    return queue;
  }

  public onIdle(
    subscription: core.ChangesSubscriptionStream,
    listener: EventListener<MariaDBSubscriptionEvents, 'idle'>,
  ): void {
    this.#subscriptions.get(subscription)?.onIdle(listener);
  }

  public async waitForIdle(
    subscription: core.ChangesSubscriptionStream,
  ): Promise<void> {
    await this.#subscriptions.get(subscription)?.waitForIdle();
  }

  public unsubscribe(subscription: core.ChangesSubscriptionStream): void {
    this.#subscriptions.delete(subscription);
  }
}
