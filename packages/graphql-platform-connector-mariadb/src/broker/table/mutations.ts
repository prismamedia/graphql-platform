import * as core from '@prismamedia/graphql-platform';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { MariaDBBroker } from '../../broker.js';
import { escapeIdentifier } from '../../escaping.js';
import type { OkPacket, PoolConnection } from '../../index.js';
import { Event } from '../../schema/event.js';
import {
  BigIntType,
  JsonType,
  TimestampType,
} from '../../schema/table/data-type.js';
import type { StatementKind } from '../../statement.js';
import { AND } from '../../statement/manipulation/clause/where-condition.js';
import { AbstractTable } from '../abstract-table.js';
import type { MariaDBSubscription } from '../subscription.js';

interface MariaDBBrokerMutationRow {
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

export type UnassignedMutationsBySubscription<
  TRequestContext extends object = any,
> = Map<MariaDBSubscription, Array<MariaDBBrokerMutation<TRequestContext>>>;

export interface MariaDBBrokerMutationsTableOptions {
  name?: string;
  janitor?: string;
}

/**
 * For every mutation, we store the request-context and the committed-at timestamp.
 *
 * The janitor is used to clean up the mutations that have been committed and whose assignments have been deleted.
 */
export class MariaDBBrokerMutationsTable extends AbstractTable {
  public constructor(
    broker: MariaDBBroker,
    public readonly options?: MariaDBBrokerMutationsTableOptions,
  ) {
    super(
      broker,
      options?.name ?? '_gp_mutations',
      {
        id: {
          dataType: new BigIntType({ modifiers: ['UNSIGNED'] }),
          nullable: false,
          autoIncrement: true,
        },
        requestContext: {
          dataType: new JsonType(),
          nullable: false,
        },
        changes: {
          dataType: new JsonType(),
          nullable: false,
        },
        committedAt: {
          dataType: new TimestampType({ microsecondPrecision: 3 }),
          nullable: false,
        },
      },
      ['id'],
      [
        // Index for the assignation
        ['id', 'committedAt'],
        // Index for the janitor
        ['committedAt', 'id'],
      ],
    );
  }

  @MGetter
  public get janitor(): Event {
    return new Event(
      this.schema,
      this.options?.janitor ?? `${this.name}_janitor`,
      `EVERY ${Math.round(this.broker.retentionInSeconds / 2)} SECOND`,
      `
        DELETE FROM ${escapeIdentifier(this.qualifiedName)}
        WHERE ${this.escapeColumnIdentifier('committedAt')} < NOW(3) - INTERVAL ${this.broker.retentionInSeconds} SECOND
          AND NOT EXISTS (
            SELECT 1
            FROM ${escapeIdentifier(this.broker.assignmentsTable.qualifiedName)}
            WHERE ${this.escapeColumnIdentifier('id')} = ${this.broker.assignmentsTable.escapeColumnIdentifier('mutationId')}
          )
      `,
      {
        comment: `Cleanup the mutations that have been committed and whose assignments have been deleted`,
      },
    );
  }

  public override async setup(
    connection: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    await super.setup(connection, { orReplace: false });
    await this.janitor.create(connection);
  }

  public async publish(
    changes: core.MutationContextChanges,
    connection: PoolConnection,
  ): Promise<bigint> {
    assert(changes.committedAt, 'The changes must have been committed');

    const { insertId: mutationId } = await connection.query<OkPacket>(
      `INSERT INTO ${escapeIdentifier(this.broker.mutationsTable.name)} (${[
        'requestContext',
        'changes',
        'committedAt',
      ]
        .map((columnName) => this.escapeColumnIdentifier(columnName))
        .join(',')}) VALUES (?, ?, ?)`,
      [
        this.broker.options?.serializeRequestContext
          ? this.broker.options.serializeRequestContext(changes.requestContext)
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
        (this.getColumnByName('committedAt').dataType as TimestampType).format(
          changes.committedAt,
        ),
      ],
    );

    return mutationId;
  }

  public async *getUnassignedsBySubscription<TRequestContext extends object>(
    batchSize: number = 100,
  ): AsyncGenerator<UnassignedMutationsBySubscription<TRequestContext>> {
    let rows: MariaDBBrokerMutationRow[];
    do {
      if (!this.broker.subscriptions.size) {
        return;
      }

      const [first, ...rest] = this.broker.subscriptions.values();

      const minAssignedMutationId = rest.reduce(
        (min, { lastAssignedMutationId }) =>
          min && lastAssignedMutationId
            ? min <= lastAssignedMutationId
              ? min
              : lastAssignedMutationId
            : min || lastAssignedMutationId,
        first.lastAssignedMutationId,
      );

      const minSince = rest.reduce(
        (min, { subscription: { since } }) => (min <= since ? min : since),
        first.subscription.since,
      );

      rows = await this.connector.executeQuery<MariaDBBrokerMutationRow[]>(`
        SELECT *
        FROM ${escapeIdentifier(this.name)}
        WHERE ${AND([
          minAssignedMutationId
            ? `${this.escapeColumnIdentifier('id')} > ${this.serializeColumnValue('id', minAssignedMutationId)}`
            : undefined,
          `${this.escapeColumnIdentifier('committedAt')} >= ${this.serializeColumnValue('committedAt', minSince)}`,
        ])}
        ORDER BY ${this.escapeColumnIdentifier('id')} ASC
        LIMIT ${batchSize}
      `);

      if (!this.broker.subscriptions.size || !rows.length) {
        return;
      }

      const mutationsBySubscription = new Map<
        MariaDBSubscription,
        Array<MariaDBBrokerMutation>
      >();

      for (const row of rows) {
        const mutation: MariaDBBrokerMutation = {
          id: row.id,
          requestContext: this.broker.options?.unserializeRequestContext
            ? this.broker.options.unserializeRequestContext(
                JSON.parse(row.requestContext),
              )
            : JSON.parse(row.requestContext),
          changes: JSON.parse(row.changes),
          committedAt: this.getColumnByName(
            'committedAt',
          ).dataType.parseColumnValue(row.committedAt),
        };

        this.broker.subscriptions
          .values()
          .filter(
            ({ lastAssignedMutationId, subscription }) =>
              (!lastAssignedMutationId ||
                lastAssignedMutationId < mutation.id) &&
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
          .forEach((subscription) => {
            let mutations = mutationsBySubscription.get(subscription);
            if (!mutations) {
              mutationsBySubscription.set(subscription, (mutations = []));
            }

            mutations.push(mutation);
          });
      }

      if (mutationsBySubscription.size) {
        yield mutationsBySubscription;
      }
    } while (rows.length === batchSize);
  }
}
