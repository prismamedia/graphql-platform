import * as core from '@prismamedia/graphql-platform';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { MariaDBBroker } from '../../broker.js';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { OkPacket, PoolConnection } from '../../index.js';
import { Event } from '../../schema/event.js';
import {
  BigIntType,
  IntType,
  JsonType,
  TimestampType,
} from '../../schema/table/data-type.js';
import type { StatementKind } from '../../statement.js';
import {
  AND,
  OR,
} from '../../statement/manipulation/clause/where-condition.js';
import { AbstractTable } from '../abstract-table.js';
import type {
  MariaDBSubscription,
  MariaDBSubscriptionAssignmentDiagnosis,
} from '../subscription.js';

export interface MariaDBBrokerMutationRow {
  id: bigint;
  requestContext: string;
  changeCount: number;
  changesByNode: string;
  committedAt: string;
}

export interface MariaDBBrokerMutation<TRequestContext extends object = any> {
  id: bigint;
  requestContext: TRequestContext;
  changeCount: number;
  changesByNode: Record<
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
        changeCount: {
          dataType: new IntType({ modifiers: ['UNSIGNED'] }),
          nullable: false,
        },
        changesByNode: {
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
        'changeCount',
        'changesByNode',
        'committedAt',
      ]
        .map((columnName) => this.escapeColumnIdentifier(columnName))
        .join(',')}) VALUES (?, ?, ?, ?)`,
      [
        this.broker.options?.serializeRequestContext
          ? this.broker.options.serializeRequestContext(changes.requestContext)
          : changes.requestContext,
        changes.size,
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

  public parseRow<TRequestContext extends object>(
    row: MariaDBBrokerMutationRow,
  ): MariaDBBrokerMutation<TRequestContext> {
    return {
      id: row.id,
      requestContext: this.broker.options?.unserializeRequestContext
        ? this.broker.options.unserializeRequestContext(
            JSON.parse(row.requestContext),
          )
        : JSON.parse(row.requestContext),
      changeCount: row.changeCount,
      changesByNode: JSON.parse(row.changesByNode),
      committedAt: this.getColumnByName(
        'committedAt',
      ).dataType.parseColumnValue(row.committedAt),
    };
  }

  public filterDependencies(
    worker: MariaDBSubscription,
    alias?: string,
  ): string {
    return OR(
      worker.subscription.dependencyGraph.flattened.byNode
        .entries()
        .flatMap(([node, { creation, deletion, update }]) => [
          creation || deletion
            ? `JSON_OVERLAPS(JSON_QUERY(${this.escapeColumnIdentifier('changesByNode', alias)}, '$.${node.name}'), ${escapeStringValue(
                JSON.stringify({
                  ...(creation && { creation }),
                  ...(deletion && { deletion }),
                }),
              )})`
            : undefined,
          update?.size
            ? `JSON_OVERLAPS(JSON_QUERY(${this.escapeColumnIdentifier('changesByNode', alias)}, '$.${node.name}.update'), ${escapeStringValue(
                JSON.stringify(Array.from(update, ({ name }) => name)),
              )})`
            : undefined,
        ])
        .toArray(),
    );
  }

  public filterAssignables(
    worker: MariaDBSubscription,
    alias?: string,
  ): string {
    return AND([
      worker.lastVisitedMutationId
        ? `${this.escapeColumnIdentifier('id', alias)} > ${this.serializeColumnValue('id', worker.lastVisitedMutationId)}`
        : `${this.escapeColumnIdentifier('committedAt', alias)} > ${this.serializeColumnValue('committedAt', worker.subscription.since)}`,
      this.filterDependencies(worker, alias),
    ]);
  }

  public async *getAssignables<TRequestContext extends object>(
    worker: MariaDBSubscription,
    batchSize: number = 100,
  ): AsyncGenerator<MariaDBBrokerMutation<TRequestContext>[]> {
    let last: MariaDBBrokerMutationRow | undefined;
    let rows: MariaDBBrokerMutationRow[];

    do {
      [last, ...rows] = await this.connector.executeQuery<
        MariaDBBrokerMutationRow[]
      >(`
        (
          SELECT *
          FROM ${escapeIdentifier(this.name)}
          ORDER BY ${this.escapeColumnIdentifier('id')} DESC
          LIMIT 1
        ) UNION ALL (
          SELECT *
          FROM ${escapeIdentifier(this.name)}
          WHERE ${this.filterAssignables(worker)}
          ORDER BY ${this.escapeColumnIdentifier('id')} ASC
          LIMIT ${batchSize}
        )
      `);

      if (worker.subscription.signal.aborted) {
        return;
      }

      if (rows.length) {
        yield rows.map((row) => this.parseRow(row));

        worker.lastVisitedMutationId = rows.at(-1)!.id;
      }

      if (worker.subscription.signal.aborted) {
        return;
      }
    } while (rows.length === batchSize);

    if (last) {
      worker.lastVisitedMutationId = last.id;
    }
  }

  public async diagnose(
    worker: MariaDBSubscription,
  ): Promise<MariaDBSubscriptionAssignmentDiagnosis> {
    const row = await this.connector.getRow<{
      mutationCount: bigint | number;
      changeCount: bigint | number;
      oldestCommitDate: string | null;
      newestCommitDate: string | null;
      latencyInSeconds: bigint | number;
    }>(`
      SELECT 
        COUNT(*) AS ${escapeIdentifier('mutationCount')},
        SUM((
          SELECT COUNT(*)
          FROM ${escapeIdentifier(this.broker.changesTable.name)} c
          WHERE ${AND([
            `${this.broker.changesTable.escapeColumnIdentifier('mutationId', 'c')} = ${this.escapeColumnIdentifier('id', 'm')}`,
            this.broker.changesTable.filterDependencies(worker, 'c'),
          ])}
        )) AS ${escapeIdentifier('changeCount')},
        MIN(${this.escapeColumnIdentifier('committedAt', 'm')}) AS ${escapeIdentifier('oldestCommitDate')},
        MAX(${this.escapeColumnIdentifier('committedAt', 'm')}) AS ${escapeIdentifier('newestCommitDate')},
        IFNULL(
          ROUND(
            TIMESTAMPDIFF(
              MICROSECOND,
              MIN(${this.escapeColumnIdentifier('committedAt', 'm')}),
              NOW(3)
            ) / 1000000,
            3
          ),
          0
        ) AS ${escapeIdentifier('latencyInSeconds')}
      FROM ${escapeIdentifier(this.name)} m
      WHERE ${this.filterAssignables(worker, 'm')}
    `);

    return {
      mutationCount: Number(row.mutationCount),
      changeCount: Number(row.changeCount),
      ...(row.oldestCommitDate && {
        oldestCommitDate: this.getColumnByName(
          'committedAt',
        ).dataType.parseColumnValue(row.oldestCommitDate),
      }),
      ...(row.newestCommitDate && {
        newestCommitDate: this.getColumnByName(
          'committedAt',
        ).dataType.parseColumnValue(row.newestCommitDate),
      }),
      latencyInSeconds: Number(row.latencyInSeconds),
    };
  }
}
