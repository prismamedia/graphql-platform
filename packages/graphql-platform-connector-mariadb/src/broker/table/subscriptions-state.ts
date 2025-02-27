import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert';
import { type UUID } from 'node:crypto';
import { EOL } from 'node:os';
import type { MariaDBBroker } from '../../broker.js';
import { escapeIdentifier, escapeStringValue } from '../../escaping.js';
import type { OkPacket, PoolConnection } from '../../index.js';
import type { Table } from '../../schema.js';
import * as schema from '../../schema.js';
import { Event } from '../../schema/event.js';
import {
  CharType,
  TimestampType,
  UuidType,
} from '../../schema/table/data-type.js';
import { StatementKind } from '../../statement.js';
import type { SelectExpression } from '../../statement/manipulation/clause/select-expression.js';
import type { TableFactor } from '../../statement/manipulation/clause/table-reference.js';
import {
  AND,
  OR,
  type WhereCondition,
} from '../../statement/manipulation/clause/where-condition.js';
import {
  AbstractTable,
  type Column,
  type ColumnConfig,
} from '../abstract-table.js';

interface Reference {
  source: Column;
  target: schema.Column;
}

export interface MariaDBBrokerSubscriptionsStateTableOptions {
  /**
   * Enables subscriptions' state tracking for optimized cache invalidation.
   *
   * When enabled, store the last revalidation timestamp (revalidatedAt) and hash of every subscriptions' documents.
   * These informations are then used to reduce the number of changes sent to the clients that are not needed.
   *
   * @default false
   */
  enabled?: utils.OptionalFlag;

  /**
   * Optional, the name of the column
   *
   * @default _gp_{tableName}_subscriptions_state
   */
  name?: string;

  /**
   * Optional, the name of the event that will be used to clean up the subscriptions' state
   *
   * @default _gp_{tableName}_subscriptions_state_janitor
   */
  janitor?: string;
}

export class MariaDBBrokerSubscriptionsStateTable extends AbstractTable {
  public readonly references: ReadonlyArray<Reference>;

  public readonly hashAliases = {
    OLD: 'oldHash',
    NEW: 'newHash',
  };

  public constructor(
    broker: MariaDBBroker,
    public readonly targetTable: Table,
    public readonly options?: MariaDBBrokerSubscriptionsStateTableOptions,
  ) {
    const references: ReadonlyArray<{
      source: {
        name: Column['name'];
        config: ColumnConfig;
      };
      target: schema.Column;
    }> = targetTable.primaryKey.columns.map((target) => ({
      source: {
        name: `${inflection.underscore(targetTable.node.name)}_${inflection.underscore(target.name)}`,
        config: {
          dataType: target.dataType,
          nullable: target.isNullable(),
        },
      },
      target,
    }));

    super(
      broker,
      options?.name ?? `_gp_${targetTable.name}_subscriptions_state`,
      {
        ...Object.fromEntries(
          references.map(({ source }) => [source.name, source.config]),
        ),
        subscriptionId: {
          dataType: new UuidType(),
          nullable: false,
        },
        hash: {
          comment: 'The SHA-256 hash of the document',
          dataType: new CharType({ length: 64 }),
          nullable: false,
        },
        revalidatedAt: {
          comment: 'The timestamp of the last revalidation',
          dataType: new TimestampType({ microsecondPrecision: 3 }),
          nullable: false,
        },
        heartbeatAt: {
          dataType: new TimestampType({ microsecondPrecision: 3 }),
          nullable: false,
        },
      },
      [...references.map(({ source: { name } }) => name), 'subscriptionId'],
      [
        // Index for the unsubscription
        ['subscriptionId'],
        // Index for the janitor
        ['revalidatedAt'],
      ],
      [references.map(({ source: { name }, target }) => [name, target])],
    );

    this.references = references.map(({ source: { name }, target }) => ({
      source: this.getColumnByName(name),
      target,
    }));
  }

  @MGetter
  public get janitor(): Event {
    return new Event(
      this.schema,
      this.options?.janitor ?? `${this.name}_janitor`,
      `EVERY ${this.broker.heartbeatIntervalInSeconds} SECOND`,
      `
        DELETE FROM ${escapeIdentifier(this.qualifiedName)}
        WHERE ${this.escapeColumnIdentifier('heartbeatAt')} < NOW(3) - INTERVAL ${this.broker.heartbeatIntervalInSeconds * 2} SECOND
      `,
      {
        comment: `Cleanup the subscriptions' state that have not been heartbeat for a while`,
      },
    );
  }

  public override async setup(
    connection: PoolConnection<StatementKind.DATA_DEFINITION>,
  ): Promise<void> {
    await super.setup(connection);
    await this.janitor.create(connection);
  }

  public select(
    tableReference: TableFactor,
    { id }: core.ChangesSubscriptionCacheControlInputValue,
  ): SelectExpression {
    assert.strictEqual(tableReference.table, this.targetTable);
    const joinTable = tableReference.joinSubscriptionsState(id);

    return [
      ...this.references.map(({ target }) =>
        tableReference.escapeColumnIdentifier(target),
      ),
      `${joinTable.escapeColumnIdentifier('hash')} AS ${escapeIdentifier(this.hashAliases.OLD)}`,
      `NOW(3) AS ${escapeIdentifier('revalidatedAt')}`,
    ].join(',');
  }

  public filter(
    tableReference: TableFactor,
    {
      id,
      ifModifiedSince,
      maxAge,
    }: core.ChangesSubscriptionCacheControlInputValue,
  ): WhereCondition {
    assert.strictEqual(tableReference.table, this.targetTable);
    const joinTable = tableReference.joinSubscriptionsState(id);

    return OR([
      `${joinTable.escapeColumnIdentifier('revalidatedAt')} IS NULL`,
      AND([
        `${joinTable.escapeColumnIdentifier('revalidatedAt')} > ${this.serializeColumnValue('revalidatedAt', ifModifiedSince)}`,
        maxAge
          ? `${joinTable.escapeColumnIdentifier('revalidatedAt')} > NOW(3) - INTERVAL ${maxAge} SECOND`
          : undefined,
      ]),
    ]);
  }

  public compareHashes(sql: string, selectionKey: string): string {
    return [
      `SELECT data.*, SHA2(data.${escapeIdentifier(selectionKey)}, 256) AS ${escapeIdentifier(this.hashAliases.NEW)}`,
      `FROM (${sql}) AS data`,
      `HAVING ${OR([
        `data.${escapeIdentifier(this.hashAliases.OLD)} IS NULL`,
        `data.${escapeIdentifier(this.hashAliases.OLD)} != ${escapeIdentifier(this.hashAliases.NEW)}`,
      ])}`,
    ].join(EOL);
  }

  public async revalidate(
    rows: ReadonlyArray<utils.PlainObject>,
    { id }: core.ChangesSubscriptionCacheControlInputValue,
    connection?: PoolConnection<StatementKind.DATA_MANIPULATION>,
  ): Promise<void> {
    await this.connector.withConnection<OkPacket>(
      (connection) =>
        connection.query(`
          INSERT INTO ${escapeIdentifier(this.name)} (${[
            ...this.references.map(({ source }) => source.name),
            'subscriptionId',
            'hash',
            'revalidatedAt',
            'heartbeatAt',
          ]
            .map((columnName) => this.escapeColumnIdentifier(columnName))
            .join(',')})
          VALUES ${Array.from(
            rows,
            (row) =>
              `(${[
                ...this.references.map(({ source, target }) =>
                  source.dataType.serialize(target.pickLeafValueFromRow(row)),
                ),
                this.serializeColumnValue('subscriptionId', id),
                this.serializeColumnValue('hash', row[this.hashAliases.NEW]),
                escapeStringValue(row['revalidatedAt']),
                'NOW(3)',
              ].join(',')})`,
          ).join(',')}
          ON DUPLICATE KEY UPDATE
            ${this.escapeColumnIdentifier('hash')} = VALUES(${this.escapeColumnIdentifier('hash')}),
            ${this.escapeColumnIdentifier('revalidatedAt')} = VALUES(${this.escapeColumnIdentifier('revalidatedAt')}),
            ${this.escapeColumnIdentifier('heartbeatAt')} = VALUES(${this.escapeColumnIdentifier('heartbeatAt')})
        `),
      StatementKind.DATA_MANIPULATION,
      connection,
    );
  }

  public async unsubscribe(subscriptionId: UUID): Promise<void> {
    await this.connector.executeQuery<OkPacket>(`
      DELETE FROM ${escapeIdentifier(this.name)}
      WHERE ${this.escapeColumnIdentifier('subscriptionId')} = ${this.serializeColumnValue('subscriptionId', subscriptionId)}
    `);
  }

  public async heartbeat(subscriptionIds: Iterable<UUID>): Promise<void> {
    await this.connector.executeQuery<OkPacket>(`
      UPDATE ${escapeIdentifier(this.name)} 
      SET ${this.escapeColumnIdentifier('heartbeatAt')} = NOW(3)
      WHERE ${this.escapeColumnIdentifier('subscriptionId')} IN (${Array.from(subscriptionIds, (subscriptionId) => this.serializeColumnValue('subscriptionId', subscriptionId)).join(',')})
    `);
  }
}
