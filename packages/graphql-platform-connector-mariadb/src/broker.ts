import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import {
  MariaDBSubscription,
  msTimestampType,
  type MariaDBSubscriptionEvents,
} from './broker/subscription.js';
import { escapeIdentifier, escapeStringValue } from './escaping.js';
import type { MariaDBConnector, OkPacket } from './index.js';
import { AND } from './statement/manipulation/clause/where-condition.js';

export {
  MariaDBSubscription,
  type MariaDBSubscriptionEvents,
} from './broker/subscription.js';

export interface SerializedMariaDBBrokerMutation {
  id: bigint;
  requestContext: string;
  changes: string;
  committedAt: string;
}

export interface MariaDBBrokerMutation<TRequestContext extends object = any> {
  id: bigint;
  requestContext: TRequestContext;
  changes: Record<
    core.Node['name'],
    Partial<{
      creation: true;
      update: core.Component['name'][];
      deletion: true;
    }>
  >;
  committedAt: Date;
}

export interface SerializedMariaDBBrokerChange {
  mutationId: bigint;
  id: bigint;
  node: string;
  kind: utils.MutationType;
  oldValue: string | null;
  newValue: string | null;
  executedAt: string;
  committedAt: string;
}

export interface MariaDBBrokerOptions<TRequestContext extends object = any> {
  enabled?: utils.OptionalFlag;

  assignmentsTable?: string;
  assignmentsJanitorEvent?: string;
  changesTable?: string;
  mutationsTable?: string;
  mutationsJanitorEvent?: string;

  /**
   * The number of seconds to wait before polling for new assignments.
   *
   * @default 1
   */
  assignerInterval?: number;

  /**
   * The number of seconds to wait between heartbeats.
   *
   * @default 30
   */
  heartbeatInterval?: number;

  /**
   * The number of seconds to keep the unassigned requests in the database.
   *
   * @default 300
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

export type MariaDBBrokerEvents = {
  subscription: MariaDBSubscription;
  unsubscription: MariaDBSubscription;
  idle: undefined;
  assigner: undefined;
  heartbeat: undefined;
};

export class MariaDBBroker<TRequestContext extends object = any>
  extends AsyncEventEmitter<MariaDBBrokerEvents>
  implements core.BrokerInterface
{
  public readonly assignmentsTableName: string;
  public readonly assignmentsJanitorEventName: string;

  public readonly changesTableName: string;

  public readonly mutationsTableName: string;
  public readonly mutationsJanitorEventName: string;

  public readonly assignerIntervalInSeconds: number;
  public readonly heartbeatIntervalInSeconds: number;
  public readonly retentionInSeconds: number;
  public readonly batchSize: number;

  public readonly subscriptions = new Map<
    core.ChangesSubscriptionStream,
    MariaDBSubscription
  >();

  #assigning: boolean = false;
  #assigner?: NodeJS.Timeout;
  #assignerBatchSize: number = 100;

  #heartbeating: boolean = false;
  #heartbeat?: NodeJS.Timeout;

  public constructor(
    public readonly connector: MariaDBConnector<TRequestContext>,
    public readonly options?: MariaDBBrokerOptions<TRequestContext>,
  ) {
    super();

    this.assignmentsTableName = options?.assignmentsTable ?? '_gp_assignments';
    this.assignmentsJanitorEventName =
      options?.assignmentsJanitorEvent ??
      `${this.assignmentsTableName}_janitor`;

    this.changesTableName = options?.changesTable ?? '_gp_changes';

    this.mutationsTableName = options?.mutationsTable ?? '_gp_mutations';
    this.mutationsJanitorEventName =
      options?.mutationsJanitorEvent ?? `${this.mutationsTableName}_janitor`;

    this.assignerIntervalInSeconds = Math.max(
      1,
      options?.assignerInterval ?? 1,
    );
    this.heartbeatIntervalInSeconds = Math.max(
      1,
      options?.heartbeatInterval ?? 30,
    );
    this.retentionInSeconds = Math.max(1, options?.retention ?? 300);
    this.batchSize = Math.max(1, options?.batchSize ?? 100);
  }

  public async setup(connection?: mariadb.Connection): Promise<void> {
    const queries = [
      `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.mutationsTableName}`)} (${[
        `${escapeIdentifier('id')} BIGINT UNSIGNED AUTO_INCREMENT NOT NULL PRIMARY KEY`,
        `${escapeIdentifier('requestContext')} JSON NOT NULL`,
        `${escapeIdentifier('changes')} JSON NOT NULL`,
        `${escapeIdentifier('committedAt')} ${msTimestampType.definition} NOT NULL`,
        ...[['id', 'committedAt'], ['committedAt']].map(
          (columns) =>
            `INDEX idx_${columns.join('_')} (${columns.map(escapeIdentifier).join(',')})`,
        ),
      ].join(',')})`,
      `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.changesTableName}`)} (${[
        `${escapeIdentifier('mutationId')} BIGINT UNSIGNED NOT NULL`,
        `${escapeIdentifier('id')} BIGINT UNSIGNED NOT NULL`,
        `${escapeIdentifier('node')} VARCHAR(255) NOT NULL`,
        `${escapeIdentifier('kind')} ENUM(${utils.mutationTypes.map(escapeStringValue).join(',')}) NOT NULL`,
        `${escapeIdentifier('oldValue')} JSON NULL`,
        `${escapeIdentifier('newValue')} JSON NULL`,
        `${escapeIdentifier('executedAt')} ${msTimestampType.definition} NOT NULL`,
        `PRIMARY KEY (${['mutationId', 'id'].map(escapeIdentifier).join()})`,
        `FOREIGN KEY ${escapeIdentifier(`fk_${this.changesTableName}_mutationId`)} (${escapeIdentifier('mutationId')}) REFERENCES ${escapeIdentifier(`${this.connector.schema}.${this.mutationsTableName}`)}(${escapeIdentifier('id')}) ON DELETE CASCADE`,
        ...[['mutationId', 'id', 'node', 'kind']].map(
          (columns) =>
            `INDEX idx_${columns.join('_')} (${columns.map(escapeIdentifier).join(',')})`,
        ),
      ].join(',')})`,
      `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.assignmentsTableName}`)} (${[
        `${escapeIdentifier('mutationId')} BIGINT UNSIGNED NOT NULL`,
        `${escapeIdentifier('subscriptionId')} UUID NOT NULL`,
        `${escapeIdentifier('heartbeatAt')} ${msTimestampType.definition} NOT NULL`,
        `PRIMARY KEY (${['mutationId', 'subscriptionId'].map(escapeIdentifier).join()})`,
        `FOREIGN KEY ${escapeIdentifier(`fk_${this.assignmentsTableName}_mutationId`)} (${escapeIdentifier('mutationId')}) REFERENCES ${escapeIdentifier(`${this.connector.schema}.${this.mutationsTableName}`)}(${escapeIdentifier('id')}) ON DELETE CASCADE`,
        ...[['subscriptionId'], ['heartbeatAt']].map(
          (columns) =>
            `INDEX idx_${columns.join('_')} (${columns.map(escapeIdentifier).join(',')})`,
        ),
      ].join(',')})`,
      `CREATE EVENT IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.assignmentsJanitorEventName}`)}
        ON SCHEDULE EVERY ${this.heartbeatIntervalInSeconds} SECOND
        DO
          DELETE FROM ${escapeIdentifier(`${this.connector.schema}.${this.assignmentsTableName}`)}
          WHERE ${escapeIdentifier('heartbeatAt')} < NOW(3) - INTERVAL ${this.heartbeatIntervalInSeconds * 2} SECOND;
      `,
      `CREATE EVENT IF NOT EXISTS ${escapeIdentifier(`${this.connector.schema}.${this.mutationsJanitorEventName}`)}
        ON SCHEDULE EVERY ${Math.round(this.retentionInSeconds / 2)} SECOND
        DO
          DELETE FROM ${escapeIdentifier(`${this.connector.schema}.${this.mutationsTableName}`)}
          WHERE ${escapeIdentifier('committedAt')} < NOW(3) - INTERVAL ${this.retentionInSeconds} SECOND
            AND NOT EXISTS (
              SELECT 1
              FROM ${escapeIdentifier(`${this.connector.schema}.${this.assignmentsTableName}`)}
              WHERE ${escapeIdentifier('mutationId')} = ${escapeIdentifier('id')}
            );
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
    await this.connector.withConnectionInTransaction(async (connection) => {
      assert(changes.committedAt, 'The changes must have been committed');

      const { insertId: mutationId } = await connection.query<OkPacket>(
        `INSERT INTO ${escapeIdentifier(this.mutationsTableName)} (${['requestContext', 'changes', 'committedAt'].map(escapeIdentifier).join(',')}) VALUES (?, ?, ?)`,
        [
          this.options?.serializeRequestContext
            ? this.options.serializeRequestContext(changes.requestContext)
            : changes.requestContext,
          Object.fromEntries(
            changes.changesByNode.values().map((changes) => [
              changes.node.name,
              {
                ...(changes.creation.size && { creation: true }),
                ...(changes.update.size && {
                  update: Array.from(
                    changes.update
                      .values()
                      .reduce(
                        (components, { updatesByComponent }) =>
                          components.union(updatesByComponent),
                        new Set<core.Component>(),
                      ),
                    ({ name }) => name,
                  ),
                }),
                ...(changes.deletion.size && { deletion: true }),
              },
            ]),
          ),
          msTimestampType.format(changes.committedAt),
        ],
      );

      await connection.query(
        `
          INSERT INTO ${escapeIdentifier(this.changesTableName)} (${['mutationId', 'id', 'node', 'kind', 'oldValue', 'newValue', 'executedAt'].map(escapeIdentifier).join(',')})
          VALUES ${Array.from(
            changes,
            (change, id) =>
              `(${[
                mutationId,
                id + 1,
                escapeStringValue(change.node.name),
                escapeStringValue(change.kind),
                ...(change instanceof core.NodeCreation
                  ? [
                      'NULL',
                      escapeStringValue(
                        JSON.stringify(change.serializedNewValue),
                      ),
                    ]
                  : change instanceof core.NodeUpdate
                    ? [
                        escapeStringValue(
                          JSON.stringify(change.serializedOldValue),
                        ),
                        escapeStringValue(
                          JSON.stringify(change.serializedUpdates),
                        ),
                      ]
                    : [
                        escapeStringValue(
                          JSON.stringify(change.serializedOldValue),
                        ),
                        'NULL',
                      ]),
                msTimestampType.serialize(change.executedAt),
              ].join(',')})`,
          ).join(',')}
        `,
      );
    });
  }

  public async assign(): Promise<void> {
    if (this.#assigning) {
      // Avoid overlapping assignments
      return;
    } else if (!this.subscriptions.size) {
      // No subscriptions, no need to assign
      return;
    }

    await this.emit('assigner', undefined);

    this.#assigning = true;
    try {
      let serializedMutations: ReadonlyArray<SerializedMariaDBBrokerMutation>;

      do {
        serializedMutations = await this.connector.executeQuery<
          SerializedMariaDBBrokerMutation[]
        >(
          `
            SELECT *
            FROM ${escapeIdentifier(this.mutationsTableName)}
            WHERE ${AND([
              `${escapeIdentifier('id')} > ?`,
              `${escapeIdentifier('committedAt')} >= ?`,
            ])}
            ORDER BY ${escapeIdentifier('id')} ASC
            LIMIT ${this.#assignerBatchSize}
          `,
          [
            this.subscriptions
              .values()
              .reduce(
                (min, { assignedMutationId }) =>
                  assignedMutationId < min ? assignedMutationId : min,
                this.subscriptions.values().next().value!.assignedMutationId,
              ),
            msTimestampType.format(
              this.subscriptions
                .values()
                .reduce(
                  (min, { subscription }) =>
                    min < subscription.since ? min : subscription.since,
                  this.subscriptions.values().next().value!.subscription.since,
                ),
            ),
          ],
        );

        if (this.subscriptions.size && serializedMutations.length) {
          const assignmentsBySubscription = new Map<
            MariaDBSubscription,
            Array<MariaDBBrokerMutation>
          >();

          for (const serializedMutation of serializedMutations) {
            const mutation: MariaDBBrokerMutation<TRequestContext> = {
              id: serializedMutation.id,
              requestContext: this.options?.unserializeRequestContext
                ? this.options.unserializeRequestContext(
                    JSON.parse(serializedMutation.requestContext),
                  )
                : JSON.parse(serializedMutation.requestContext),
              changes: JSON.parse(serializedMutation.changes),
              committedAt: msTimestampType.parseColumnValue(
                serializedMutation.committedAt,
              ),
            };

            this.subscriptions
              .values()
              .filter(
                ({ assignedMutationId, subscription }) =>
                  assignedMutationId <= serializedMutation.id &&
                  subscription.since <= mutation.committedAt &&
                  subscription.dependencyGraph.flattened.byNode
                    .entries()
                    .some(
                      ([node, { creation, update, deletion }]) =>
                        mutation.changes[node.name] &&
                        ((creation && mutation.changes[node.name].creation) ||
                          (update?.size &&
                            mutation.changes[node.name].update?.length &&
                            update
                              .values()
                              .some((component) =>
                                mutation.changes[node.name].update!.includes(
                                  component.name,
                                ),
                              )) ||
                          (deletion && mutation.changes[node.name].deletion)),
                    ),
              )
              .forEach((assignable) => {
                let assignments = assignmentsBySubscription.get(assignable);
                if (!assignments) {
                  assignmentsBySubscription.set(assignable, (assignments = []));
                }

                assignments.push(mutation);
              });
          }

          if (assignmentsBySubscription.size) {
            await Promise.all([
              this.connector.executeQuery(`
                INSERT INTO ${escapeIdentifier(this.assignmentsTableName)} (${['mutationId', 'subscriptionId', 'heartbeatAt'].map(escapeIdentifier).join(',')})
                VALUES ${assignmentsBySubscription
                  .entries()
                  .flatMap(([subscription, assignments]) =>
                    assignments.map(
                      (mutation) =>
                        `(${[mutation.id, escapeStringValue(subscription.id), 'NOW(3)'].join(',')})`,
                    ),
                  )
                  .toArray()
                  .join(',')}
              `),
              ...Array.from(
                assignmentsBySubscription,
                ([subscription, assignments]) =>
                  subscription.assign(assignments),
              ),
            ]);
          }
        }
      } while (
        this.subscriptions.size &&
        serializedMutations.length === this.#assignerBatchSize
      );
    } finally {
      this.#assigning = false;
    }
  }

  public async heartbeat(): Promise<void> {
    if (this.#heartbeating) {
      // Avoid overlapping heartbeats
      return;
    } else if (!this.subscriptions.size) {
      // No subscriptions, no need to heartbeat
      return;
    }

    await this.emit('heartbeat', undefined);

    this.#heartbeating = true;
    try {
      await this.connector.executeQuery(
        `
          UPDATE ${escapeIdentifier(this.assignmentsTableName)} 
          SET ${escapeIdentifier('heartbeatAt')} = NOW(3)
            WHERE ${escapeIdentifier('subscriptionId')} IN (${Array.from(this.subscriptions.values(), ({ id }) => escapeStringValue(id)).join(',')})
        `,
      );
    } finally {
      this.#heartbeating = false;
    }
  }

  public async subscribe(
    subscription: core.ChangesSubscriptionStream,
  ): Promise<core.NodeChangeSubscriptionInterface> {
    const worker = new MariaDBSubscription(this, subscription);

    this.subscriptions.set(subscription, worker);
    await this.emit('subscription', worker);

    this.#assigner ??= setInterval(
      () =>
        this.assign().catch((cause) =>
          this.emit('error', new Error('Assigner failed', { cause })),
        ),
      this.assignerIntervalInSeconds * 1000,
    );

    this.#heartbeat ??= setInterval(
      () =>
        this.heartbeat().catch((cause) =>
          this.emit('error', new Error('Heartbeat failed', { cause })),
        ),
      this.heartbeatIntervalInSeconds * 1000,
    );

    return worker;
  }

  public onIdle(
    subscription: core.ChangesSubscriptionStream,
    listener: EventListener<MariaDBSubscriptionEvents, 'idle'>,
  ): void {
    this.subscriptions.get(subscription)?.onIdle(listener);
  }

  public async waitForIdle(
    subscription: core.ChangesSubscriptionStream,
  ): Promise<void> {
    await this.subscriptions.get(subscription)?.waitForIdle();
  }

  public async unsubscribe(
    subscription: core.ChangesSubscriptionStream,
  ): Promise<void> {
    const worker = this.subscriptions.get(subscription);
    if (worker) {
      this.subscriptions.delete(subscription);

      if (!this.subscriptions.size) {
        clearInterval(this.#assigner);
        this.#assigner = undefined;

        clearInterval(this.#heartbeat);
        this.#heartbeat = undefined;
      }

      await Promise.all([
        this.emit('unsubscription', worker),
        !this.subscriptions.size && this.emit('idle', undefined),
      ]);
    }
  }
}
