import { MGetter } from '@prismamedia/memoize';
import type { UUID } from 'node:crypto';
import type {
  MariaDBBroker,
  MariaDBBrokerMutation,
  MariaDBSubscription,
} from '../../broker.js';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { OkPacket } from '../../index.js';
import { Event } from '../../schema/event.js';
import {
  BigIntType,
  TimestampType,
  UuidType,
} from '../../schema/table/data-type.js';
import { AND } from '../../statement/manipulation/clause/where-condition.js';
import { AbstractTable } from '../abstract-table.js';

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
          dataType: new TimestampType({ microsecondPrecision: 3 }),
          nullable: false,
        },
      },
      ['mutationId', 'subscriptionId'],
      [
        // Index for the heartbeat
        ['subscriptionId'],
        // Index for the janitor
        ['heartbeatAt'],
      ],
      [['mutationId', broker.mutationsTable.getColumnByName('id')]],
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
        WHERE ${escapeIdentifier('heartbeatAt')} < NOW(3) - INTERVAL ${this.broker.heartbeatIntervalInSeconds * 2} SECOND
      `,
    );
  }

  public async assign(
    assignmentsBySubscription: ReadonlyMap<
      MariaDBSubscription,
      ReadonlyArray<MariaDBBrokerMutation>
    >,
  ): Promise<void> {
    await this.broker.connector.executeQuery<OkPacket>(
      `
        INSERT INTO ${escapeIdentifier(this.name)} (${['mutationId', 'subscriptionId', 'heartbeatAt'].map(escapeIdentifier).join(',')})
        VALUES ${assignmentsBySubscription
          .entries()
          .flatMap(([{ subscription }, assignments]) =>
            assignments.map(
              (mutation) =>
                `(${[mutation.id, escapeStringValue(subscription.id), 'NOW(3)'].join(',')})`,
            ),
          )
          .toArray()
          .join(',')}
      `,
    );
  }

  public async unassign(
    subscriptionId: UUID,
    mutationId?: bigint,
  ): Promise<void> {
    await this.broker.connector.executeQuery<OkPacket>(
      `
        DELETE FROM ${escapeIdentifier(this.broker.assignmentsTable.name)}
        WHERE ${AND([
          `${escapeIdentifier('subscriptionId')} = ${escapeStringValue(subscriptionId)}`,
          mutationId
            ? `${escapeIdentifier('mutationId')} = ${mutationId}`
            : undefined,
        ])}
      `,
    );
  }

  public async heartbeat(subscriptionIds: Iterable<UUID>): Promise<void> {
    await this.broker.connector.executeQuery<OkPacket>(
      `
        UPDATE ${escapeIdentifier(this.name)} 
        SET ${escapeIdentifier('heartbeatAt')} = NOW(3)
        WHERE ${escapeIdentifier('subscriptionId')} IN (${Array.from(subscriptionIds, escapeStringValue).join(',')})
      `,
    );
  }
}
