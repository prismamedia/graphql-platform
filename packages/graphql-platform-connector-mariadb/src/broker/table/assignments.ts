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
  MariaDBBrokerMutation,
  MariaDBBrokerMutationRow,
  UnassignedMutationsBySubscription,
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
    mutationsBySubscription: UnassignedMutationsBySubscription,
  ): Promise<void> {
    await this.connector.executeQuery<OkPacket>(`
      INSERT INTO ${escapeIdentifier(this.name)} (${[
        'mutationId',
        'subscriptionId',
        'heartbeatAt',
      ]
        .map((columnName) => this.escapeColumnIdentifier(columnName))
        .join(',')})
      VALUES ${mutationsBySubscription
        .entries()
        .flatMap(([{ subscription }, mutations]) =>
          mutations.map(
            (mutation) =>
              `(${[
                this.serializeColumnValue('mutationId', mutation.id),
                this.serializeColumnValue('subscriptionId', subscription.id),
                'NOW()',
              ].join(',')})`,
          ),
        )
        .toArray()
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
            INNER JOIN ${escapeIdentifier(this.broker.mutationsTable.name)} m ON m.${this.broker.mutationsTable.escapeColumnIdentifier('id')} = a.${this.escapeColumnIdentifier('mutationId')}
          WHERE a.${this.escapeColumnIdentifier('subscriptionId')} = ${this.serializeColumnValue('subscriptionId', subscriptionId)}
          ORDER BY a.${this.escapeColumnIdentifier('mutationId')} ASC
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
}
