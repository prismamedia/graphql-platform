import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { MariaDBBroker } from '../../broker.js';
import { escapeIdentifier } from '../../escaping.js';
import type { PoolConnection } from '../../index.js';
import {
  BigIntType,
  EnumType,
  JsonType,
  TimestampType,
  VarCharType,
} from '../../schema/table/data-type.js';
import { AbstractTable } from '../abstract-table.js';

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

export interface MariaDBBrokerChangesTableOptions {
  name?: string;
}

export class MariaDBBrokerChangesTable extends AbstractTable {
  public constructor(
    broker: MariaDBBroker,
    public readonly options?: MariaDBBrokerChangesTableOptions,
  ) {
    super(
      broker,
      options?.name ?? '_gp_changes',
      {
        mutationId: {
          dataType: new BigIntType({ modifiers: ['UNSIGNED'] }),
          nullable: false,
        },
        id: {
          dataType: new BigIntType({ modifiers: ['UNSIGNED'] }),
          nullable: false,
        },
        node: {
          dataType: new VarCharType({ length: 255 }),
          nullable: false,
        },
        kind: {
          dataType: new EnumType({ values: utils.mutationTypes }),
          nullable: false,
        },
        oldValue: {
          dataType: new JsonType(),
          nullable: true,
        },
        newValue: {
          dataType: new JsonType(),
          nullable: true,
        },
        executedAt: {
          dataType: new TimestampType({ microsecondPrecision: 3 }),
          nullable: false,
        },
      },
      ['mutationId', 'id'],
      [['mutationId', 'id', 'node', 'kind']],
      [['mutationId', broker.mutationsTable.getColumnByName('id')]],
    );
  }

  public async publish(
    mutationId: bigint,
    changes: core.MutationContextChanges,
    connection: PoolConnection,
  ): Promise<void> {
    await connection.query(
      `
        INSERT INTO ${escapeIdentifier(this.name)} (${['mutationId', 'id', 'node', 'kind', 'oldValue', 'newValue', 'executedAt'].map(escapeIdentifier).join(',')})
        VALUES ${Array.from(
          changes,
          (change, id) =>
            `(${[
              mutationId,
              id + 1,
              this.getColumnByName('node').dataType.serialize(change.node.name),
              this.getColumnByName('kind').dataType.serialize(change.kind),
              ...(change instanceof core.NodeCreation
                ? [
                    this.getColumnByName('oldValue').dataType.serialize(null),
                    this.getColumnByName('newValue').dataType.serialize(
                      change.serializedNewValue,
                    ),
                  ]
                : change instanceof core.NodeUpdate
                  ? [
                      this.getColumnByName('oldValue').dataType.serialize(
                        change.serializedOldValue,
                      ),
                      this.getColumnByName('newValue').dataType.serialize(
                        change.serializedUpdates,
                      ),
                    ]
                  : [
                      this.getColumnByName('oldValue').dataType.serialize(
                        change.serializedOldValue,
                      ),
                      this.getColumnByName('newValue').dataType.serialize(null),
                    ]),
              this.getColumnByName('executedAt').dataType.serialize(
                change.executedAt,
              ),
            ].join(',')})`,
        ).join(',')}
      `,
    );
  }
}
