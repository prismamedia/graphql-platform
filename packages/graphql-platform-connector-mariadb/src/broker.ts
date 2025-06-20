import {
  AsyncEventEmitter,
  type EventListener,
} from '@prismamedia/async-event-emitter';
import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as R from 'remeda';
import type { JsonObject } from 'type-fest';
import { BrokerError, BrokerErrorCode } from './broker/error.js';
import {
  MariaDBSubscription,
  type MariaDBSubscriptionDiagnosis,
  type MariaDBSubscriptionEvents,
} from './broker/subscription.js';
import {
  MariaDBBrokerAssignmentsTable,
  MariaDBBrokerChangesTable,
  MariaDBBrokerMutationsTable,
  MariaDBBrokerSubscriptionsStateTable,
  type MariaDBBrokerAssignmentsTableOptions,
  type MariaDBBrokerChangesTableOptions,
  type MariaDBBrokerMutationsTableOptions,
} from './broker/table.js';
import type { MariaDBConnector, PoolConnection } from './index.js';
import { StatementKind } from './statement.js';

export * from './broker/error.js';
export {
  MariaDBSubscription,
  MariaDBSubscriptionDiagnosis,
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
   * @default 5
   */
  assignerInterval?: number;

  /**
   * The number of seconds to wait between heartbeats.
   *
   * @default 60 * 5 (5 minutes)
   */
  heartbeatInterval?: number;

  /**
   * The number of missed heartbeats allowed before assignments and subscriptions' state are considered stale.
   *
   * @default 2
   */
  allowedHeartbeatMisses?: number;

  /**
   * The number of seconds to keep the unassigned mutations in the database.
   *
   * @default 60 * 15 (15 minutes)
   */
  retention?: number;

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
  public readonly heartbeatMaxAgeInSeconds: number;
  public readonly retentionInSeconds: number;

  public readonly mutationsTable: MariaDBBrokerMutationsTable;
  public readonly changesTable: MariaDBBrokerChangesTable;
  public readonly assignmentsTable: MariaDBBrokerAssignmentsTable;

  public readonly subscriptions = new Map<
    core.ChangesSubscriptionStream,
    MariaDBSubscription
  >();

  #heartbeating: boolean = false;
  #heartbeat?: NodeJS.Timeout;

  public constructor(
    public readonly connector: MariaDBConnector<TRequestContext>,
    public readonly options?: MariaDBBrokerOptions<TRequestContext>,
  ) {
    super();

    this.assignerIntervalInSeconds = options?.assignerInterval ?? 5;
    this.heartbeatIntervalInSeconds = options?.heartbeatInterval ?? 60 * 5;
    this.heartbeatMaxAgeInSeconds =
      this.heartbeatIntervalInSeconds *
      ((options?.allowedHeartbeatMisses ?? 2) + 1);
    this.retentionInSeconds = options?.retention ?? 60 * 15;

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

  @MGetter
  public get subscriptionsStateTables(): ReadonlyArray<MariaDBBrokerSubscriptionsStateTable> {
    return R.pipe(
      this.connector.schema.tables,
      R.map((table) => table.subscriptionsStateTable),
      R.filter(R.isDefined),
    );
  }

  public async setup(
    connection?: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    await this.connector.withConnection(
      async (connection) => {
        await this.mutationsTable.setup(connection);
        await this.changesTable.setup(connection);
        await this.assignmentsTable.setup(connection);

        for (const table of this.subscriptionsStateTables) {
          await table.setup(connection);
        }

        await this.connector.ensureEventSchedulerIsEnabled(connection);
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
      await utils.PromiseAllSettledThenThrowIfErrors([
        this.assignmentsTable.heartbeat(
          this.subscriptions.values().map(({ subscription: { id } }) => id),
        ),
        ...Map.groupBy(
          this.subscriptions.values(),
          ({ stateTable }) => stateTable,
        )
          .entries()
          .map(([stateTable, subscriptions]) =>
            stateTable?.heartbeat(
              subscriptions.map(({ subscription: { id } }) => id),
            ),
          ),
      ]);
    } finally {
      this.#heartbeating = false;
    }
  }

  public async subscribe(
    subscription: core.ChangesSubscriptionStream,
  ): Promise<MariaDBSubscription> {
    const worker = new MariaDBSubscription(this, subscription);

    this.subscriptions.set(subscription, worker);
    await this.emit('subscription', worker);

    this.#heartbeat ??= setInterval(
      () =>
        this.heartbeat().catch((cause) =>
          this.emit(
            'error',
            new BrokerError({ code: BrokerErrorCode.HEARTBEAT, cause }),
          ),
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
        clearInterval(this.#heartbeat);
        this.#heartbeat = undefined;
      }

      await Promise.all([
        this.emit('unsubscription', worker),
        !this.subscriptions.size && this.emit('idle', undefined),
      ]);
    }
  }

  public async assign(): Promise<void> {
    await Promise.all(
      this.subscriptions.values().map((worker) => worker.assign()),
    );
  }

  public diagnose(): Promise<MariaDBSubscriptionDiagnosis[]> {
    return Promise.all(
      this.subscriptions.values().map((worker) => worker.diagnose()),
    );
  }
}
