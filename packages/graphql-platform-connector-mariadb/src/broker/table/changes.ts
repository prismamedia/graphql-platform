import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { MariaDBBroker } from '../../broker.js';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { PoolConnection } from '../../index.js';
import {
  BigIntType,
  EnumType,
  JsonType,
  TimestampType,
  VarCharType,
} from '../../schema/table/data-type.js';
import {
  AND,
  OR,
} from '../../statement/manipulation/clause/where-condition.js';
import { AbstractTable } from '../abstract-table.js';
import type { MariaDBSubscription } from '../subscription.js';
import type { MariaDBBrokerMutation } from './mutations.js';

export interface MariaDBBrokerChangeRow {
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
      [[['mutationId', broker.mutationsTable.getColumnByName('id')]]],
    );
  }

  public async publish(
    mutationId: bigint,
    changes: core.MutationContextChanges,
    connection: PoolConnection,
  ): Promise<void> {
    await connection.query(`
      INSERT INTO ${escapeIdentifier(this.name)} (${[
        'mutationId',
        'id',
        'node',
        'kind',
        'oldValue',
        'newValue',
        'executedAt',
      ]
        .map((columnName) => this.escapeColumnIdentifier(columnName))
        .join(',')})
      VALUES ${Array.from(
        changes,
        (change, id) =>
          `(${[
            this.serializeColumnValue('mutationId', mutationId),
            this.serializeColumnValue('id', id + 1),
            this.serializeColumnValue('node', change.node.name),
            this.serializeColumnValue('kind', change.kind),
            ...(change instanceof core.NodeCreation
              ? [
                  this.serializeColumnValue('oldValue', null),
                  this.serializeColumnValue(
                    'newValue',
                    change.serializedNewValue,
                  ),
                ]
              : change instanceof core.NodeUpdate
                ? [
                    this.serializeColumnValue(
                      'oldValue',
                      change.serializedOldValue,
                    ),
                    this.serializeColumnValue(
                      'newValue',
                      change.serializedUpdates,
                    ),
                  ]
                : [
                    this.serializeColumnValue(
                      'oldValue',
                      change.serializedOldValue,
                    ),
                    this.serializeColumnValue('newValue', null),
                  ]),
            this.serializeColumnValue('executedAt', change.executedAt),
          ].join(',')})`,
      ).join(',')}
    `);
  }

  public filterDependencies(
    worker: MariaDBSubscription,
    alias?: string,
  ): string {
    return OR(
      worker.subscription.dependencyTree.flattened.dependencies
        .entries()
        .map(([node, { creation, deletion, update }]) =>
          AND([
            `${this.escapeColumnIdentifier('node', alias)} = ${this.serializeColumnValue('node', node.name)}`,
            OR([
              creation || deletion
                ? `${this.escapeColumnIdentifier('kind', alias)} IN (${[
                    creation && utils.MutationType.CREATION,
                    deletion && utils.MutationType.DELETION,
                  ]
                    .filter(utils.isNonNil)
                    .map((kind) => this.serializeColumnValue('kind', kind))
                    .join(',')})`
                : undefined,
              update
                ? AND([
                    `${this.escapeColumnIdentifier('kind', alias)} = ${this.serializeColumnValue('kind', utils.MutationType.UPDATE)}`,
                    `JSON_OVERLAPS(${[
                      `JSON_KEYS(${this.escapeColumnIdentifier('newValue', alias)})`,
                      escapeStringValue(
                        JSON.stringify(Array.from(update, ({ name }) => name)),
                      ),
                    ].join(',')})`,
                  ])
                : undefined,
            ]),
          ]),
        )
        .toArray(),
    );
  }

  public async *getChanges<TRequestContext extends object>(
    worker: MariaDBSubscription,
    mutation: MariaDBBrokerMutation<TRequestContext>,
    batchSize: number = 100,
  ): AsyncGenerator<core.MutationContextChanges<TRequestContext>> {
    let lastChangeId: bigint | undefined;

    let rows: MariaDBBrokerChangeRow[];
    do {
      rows = await this.connector.executeQuery<MariaDBBrokerChangeRow[]>(`
        SELECT *
        FROM ${escapeIdentifier(this.name)}
        WHERE ${AND([
          `${this.escapeColumnIdentifier('mutationId')} = ${this.serializeColumnValue('mutationId', mutation.id)}`,
          lastChangeId
            ? `${this.escapeColumnIdentifier('id')} > ${this.serializeColumnValue('id', lastChangeId)}`
            : undefined,
          this.filterDependencies(worker),
        ])}
        ORDER BY ${escapeIdentifier('id')} ASC
        LIMIT ${batchSize}
      `);

      if (worker.subscription.signal.aborted) {
        return;
      }

      if (rows.length) {
        yield new core.MutationContextChanges(
          mutation.requestContext,
          rows.map(({ kind, ...row }) => {
            const node = this.connector.gp.getNodeByName(row.node);
            const newValue =
              this.getColumnByName('newValue').dataType.parseColumnValue(
                row.newValue,
              ) ?? undefined;
            const oldValue =
              this.getColumnByName('oldValue').dataType.parseColumnValue(
                row.oldValue,
              ) ?? undefined;
            const executedAt = this.getColumnByName(
              'executedAt',
            ).dataType.parseColumnValue(row.executedAt);

            return kind === utils.MutationType.CREATION
              ? core.NodeCreation.unserialize(
                  node,
                  mutation.requestContext,
                  newValue,
                  executedAt,
                  mutation.committedAt,
                )
              : kind === utils.MutationType.UPDATE
                ? core.NodeUpdate.unserialize(
                    node,
                    mutation.requestContext,
                    oldValue,
                    newValue,
                    executedAt,
                    mutation.committedAt,
                  )
                : core.NodeDeletion.unserialize(
                    node,
                    mutation.requestContext,
                    oldValue,
                    executedAt,
                    mutation.committedAt,
                  );
          }),
        );

        lastChangeId = rows.at(-1)!.id;
      }

      if (worker.subscription.signal.aborted) {
        return;
      }
    } while (rows.length === batchSize);
  }
}
