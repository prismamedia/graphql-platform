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
import { AbstractTable } from '../abstract-table.js';

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

export interface MariaDBBrokerMutationsTableOptions {
  name?: string;
  janitor?: string;
}

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
        WHERE ${escapeIdentifier('committedAt')} < NOW(3) - INTERVAL ${this.broker.retentionInSeconds} SECOND
          AND NOT EXISTS (
            SELECT 1
            FROM ${escapeIdentifier(this.broker.assignmentsTable.qualifiedName)}
            WHERE ${escapeIdentifier('id')} = ${escapeIdentifier('mutationId')}
          )
      `,
    );
  }

  public async publish(
    changes: core.MutationContextChanges,
    connection: PoolConnection,
  ): Promise<bigint> {
    assert(changes.committedAt, 'The changes must have been committed');

    const { insertId: mutationId } = await connection.query<OkPacket>(
      `INSERT INTO ${escapeIdentifier(this.broker.mutationsTable.name)} (${['requestContext', 'changes', 'committedAt'].map(escapeIdentifier).join(',')}) VALUES (?, ?, ?)`,
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
}
