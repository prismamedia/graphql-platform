import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { JsonObject } from 'type-fest';
import {
  MariaDBSubscription,
  msTimestampType,
  type MariaDBSubscriptionEvents,
} from './broker/subscription.js';
import {
  MariaDBBrokerAssignmentsTable,
  MariaDBBrokerChangesTable,
  MariaDBBrokerMutationsTable,
  type MariaDBBrokerAssignmentsTableOptions,
  type MariaDBBrokerChangesTableOptions,
  type MariaDBBrokerMutation,
  type MariaDBBrokerMutationsTableOptions,
  type SerializedMariaDBBrokerMutation,
} from './broker/table.js';
import { escapeIdentifier } from './escaping.js';
import type { MariaDBConnector, PoolConnection } from './index.js';
import { StatementKind } from './statement.js';
import { AND } from './statement/manipulation/clause/where-condition.js';

export {
  MariaDBSubscription,
  type MariaDBSubscriptionEvents,
} from './broker/subscription.js';
export * from './broker/table.js';

export type MariaDBBrokerEvents = {
  subscription: MariaDBSubscription;
  unsubscription: MariaDBSubscription;
  idle: undefined;
};

export interface MariaDBBrokerOptions<TRequestContext extends object = any> {
  enabled?: utils.OptionalFlag;

  mutationsTable?: MariaDBBrokerMutationsTableOptions;
  changesTable?: MariaDBBrokerChangesTableOptions;
  assignmentsTable?: MariaDBBrokerAssignmentsTableOptions;

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
   * The number of seconds to keep the unassigned mutations in the database.
   *
   * @default 60 * 5 (5 minutes)
   */
  retention?: number;

  /**
   * The maximum number of changes, from a single-mutation, to process in a single batch.
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
  extends AsyncEventEmitter<MariaDBBrokerEvents>
  implements core.BrokerInterface
{
  public readonly assignerIntervalInSeconds: number;
  public readonly heartbeatIntervalInSeconds: number;
  public readonly retentionInSeconds: number;
  public readonly batchSize: number;

  public readonly mutationsTable: MariaDBBrokerMutationsTable;
  public readonly changesTable: MariaDBBrokerChangesTable;
  public readonly assignmentsTable: MariaDBBrokerAssignmentsTable;

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

    this.assignerIntervalInSeconds = options?.assignerInterval ?? 1;
    this.heartbeatIntervalInSeconds = options?.heartbeatInterval ?? 30;
    this.retentionInSeconds = options?.retention ?? 60 * 5;
    this.batchSize = options?.batchSize ?? 100;

    this.mutationsTable = new MariaDBBrokerMutationsTable(
      this,
      options?.mutationsTable,
    );
    this.changesTable = new MariaDBBrokerChangesTable(
      this,
      options?.changesTable,
    );
    this.assignmentsTable = new MariaDBBrokerAssignmentsTable(
      this,
      options?.assignmentsTable,
    );
  }

  public async setup(connection?: PoolConnection): Promise<void> {
    await this.connector.withConnection(
      async (connection) => {
        await this.mutationsTable.setup(connection);
        await this.changesTable.setup(connection);
        await this.assignmentsTable.setup(connection);

        await this.mutationsTable.janitor.create(undefined, connection);
        await this.assignmentsTable.janitor.create(undefined, connection);
      },
      StatementKind.DATA_DEFINITION,
      connection,
    );
  }

  public async publish(changes: core.MutationContextChanges): Promise<void> {
    await this.connector.withConnectionInTransaction(async (connection) => {
      const mutationId = await this.mutationsTable.publish(changes, connection);
      await this.changesTable.publish(mutationId, changes, connection);
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

    this.#assigning = true;
    try {
      let serializedMutations: ReadonlyArray<SerializedMariaDBBrokerMutation>;

      do {
        serializedMutations = await this.connector.executeQuery<
          SerializedMariaDBBrokerMutation[]
        >(
          `
            SELECT *
            FROM ${escapeIdentifier(this.mutationsTable.name)}
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
              this.assignmentsTable.assign(assignmentsBySubscription),
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

    this.#heartbeating = true;
    try {
      await this.assignmentsTable.heartbeat(
        this.subscriptions.values().map(({ subscription: { id } }) => id),
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
