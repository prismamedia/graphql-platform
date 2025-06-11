import { MGetter } from '@prismamedia/memoize';
import type { UUID } from 'node:crypto';
import type { MariaDBBroker } from '../../broker.js';
import { escapeIdentifier } from '../../escaping.js';
import type { OkPacket, PoolConnection } from '../../index.js';
import { Event } from '../../schema/event.js';
import {
  BigIntType,
  TimestampType,
  UuidType,
} from '../../schema/table/data-type.js';
import type { StatementKind } from '../../statement.js';
import { AND } from '../../statement/manipulation/clause/where-condition.js';
import { AbstractTable } from '../abstract-table.js';
import type {
  MariaDBSubscription,
  MariaDBSubscriptionAssignmentDiagnosis,
} from '../subscription.js';
import type {
  MariaDBBrokerMutation,
  MariaDBBrokerMutationRow,
} from './mutations.js';

export interface MariaDBBrokerAssignmentsTableOptions {
  name?: string;
  janitor?: string;
}

export class MariaDBBrokerAssignmentsTable extends AbstractTable {
  public constructor(
    broker: MariaDBBroker,
    public readonly options?: MariaDBBrokerAssignmentsTableOptions,
  ) {
    super(
      broker,
      options?.name ?? '_gp_assignments',
      {
        mutationId: {
          dataType: new BigIntType({ modifiers: ['UNSIGNED'] }),
          nullable: false,
        },
        subscriptionId: {
          dataType: new UuidType(),
          nullable: false,
        },
        heartbeatAt: {
          comment: 'The timestamp of the last heartbeat',
          dataType: new TimestampType(),
          nullable: false,
        },
      },
      ['mutationId', 'subscriptionId'],
      [
        // Index for the heartbeat & the "dequeue" & the "unassign"
        ['subscriptionId', 'mutationId'],
        // Index for the janitor
        ['heartbeatAt'],
      ],
      [[['mutationId', broker.mutationsTable.getColumnByName('id')]]],
    );
  }

  @MGetter
  public get janitor(): Event {
    return new Event(
      this.schema,
      this.options?.janitor ?? `${this.name}_janitor`,
      `EVERY ${this.broker.heartbeatIntervalInSeconds} SECOND`,
      `
        DELETE FROM ${escapeIdentifier(this.qualifiedName)}
        WHERE ${this.escapeColumnIdentifier('heartbeatAt')} < NOW() - INTERVAL ${this.broker.heartbeatMaxAgeInSeconds} SECOND
      `,
      {
        comment: `Cleanup the assignments that have not been heartbeat for a while`,
      },
    );
  }

  public override async setup(
    connection: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    await super.setup(connection);
    await this.janitor.create(connection);
  }

  public async assign(
    subscriptionId: UUID,
    mutations: ReadonlyArray<MariaDBBrokerMutation>,
  ): Promise<void> {
    await this.connector.executeQuery<OkPacket>(`
      INSERT INTO ${escapeIdentifier(this.name)} (${[
        'mutationId',
        'subscriptionId',
        'heartbeatAt',
      ]
        .map((columnName) => this.escapeColumnIdentifier(columnName))
        .join(',')})
      VALUES ${mutations
        .map(
          (mutation) =>
            `(${[
              this.serializeColumnValue('mutationId', mutation.id),
              this.serializeColumnValue('subscriptionId', subscriptionId),
              'NOW()',
            ].join(',')})`,
        )
        .join(',')}
    `);
  }

  public async *dequeue<TRequestContext extends object>(
    subscriptionId: UUID,
  ): AsyncGenerator<MariaDBBrokerMutation<TRequestContext>> {
    let row: MariaDBBrokerMutationRow | undefined;
    while (
      (row = await this.connector.getRowIfExists<MariaDBBrokerMutationRow>(`
        SELECT m.*
        FROM ${escapeIdentifier(this.name)} a
          INNER JOIN ${escapeIdentifier(this.broker.mutationsTable.name)} m ON ${this.broker.mutationsTable.escapeColumnIdentifier('id', 'm')} = ${this.escapeColumnIdentifier('mutationId', 'a')}
        WHERE ${this.escapeColumnIdentifier('subscriptionId', 'a')} = ${this.serializeColumnValue('subscriptionId', subscriptionId)}
        ORDER BY ${this.escapeColumnIdentifier('mutationId', 'a')} ASC
        LIMIT 1
      `))
    ) {
      yield this.broker.mutationsTable.parseRow<TRequestContext>(row);

      await this.unassign(subscriptionId, row.id);
    }
  }

  public async unassign(
    subscriptionId: UUID,
    mutationId?: bigint,
  ): Promise<void> {
    await this.connector.executeQuery<OkPacket>(`
      DELETE FROM ${escapeIdentifier(this.name)}
      WHERE ${AND([
        `${this.escapeColumnIdentifier('subscriptionId')} = ${this.serializeColumnValue('subscriptionId', subscriptionId)}`,
        mutationId
          ? `${this.escapeColumnIdentifier('mutationId')} = ${this.serializeColumnValue('mutationId', mutationId)}`
          : undefined,
      ])}
    `);
  }

  public async unsubscribe(subscriptionId: UUID): Promise<void> {
    return this.unassign(subscriptionId);
  }

  public async heartbeat(subscriptionIds: Iterable<UUID>): Promise<void> {
    await this.connector.executeQuery<OkPacket>(`
      UPDATE ${escapeIdentifier(this.name)} 
      SET ${this.escapeColumnIdentifier('heartbeatAt')} = NOW()
      WHERE ${this.escapeColumnIdentifier('subscriptionId')} IN (${Array.from(subscriptionIds, (subscriptionId) => this.serializeColumnValue('subscriptionId', subscriptionId)).join(',')})
    `);
  }

  public async diagnose(
    worker: MariaDBSubscription,
  ): Promise<MariaDBSubscriptionAssignmentDiagnosis> {
    const row = await this.connector.getRow<{
      mutationCount: bigint | number;
      changeCount: bigint | number;
      latencyInSeconds: bigint | number;
    }>(`
      SELECT
        COUNT(*) AS ${escapeIdentifier('mutationCount')},
        SUM((
          SELECT COUNT(*)
          FROM ${escapeIdentifier(this.broker.changesTable.name)} c
          WHERE ${AND([
            `${this.broker.changesTable.escapeColumnIdentifier('mutationId', 'c')} = ${this.broker.mutationsTable.escapeColumnIdentifier('id', 'm')}`,
            this.broker.changesTable.filterDependencies(worker, 'c'),
          ])}
        )) AS ${escapeIdentifier('changeCount')},
        IFNULL(NOW(3) - MIN(${this.broker.mutationsTable.escapeColumnIdentifier('committedAt', 'm')}), 0) AS ${escapeIdentifier('latencyInSeconds')}
      FROM ${escapeIdentifier(this.name)} a
        INNER JOIN ${escapeIdentifier(this.broker.mutationsTable.name)} m ON ${this.escapeColumnIdentifier('mutationId', 'a')} = ${this.broker.mutationsTable.escapeColumnIdentifier('id', 'm')}
      WHERE ${this.escapeColumnIdentifier('subscriptionId', 'a')} = ${this.serializeColumnValue('subscriptionId', worker.subscription.id)}
    `);

    return {
      mutationCount: Number(row.mutationCount),
      changeCount: Number(row.changeCount),
      latencyInSeconds: Number(row.latencyInSeconds),
    };
  }
}
