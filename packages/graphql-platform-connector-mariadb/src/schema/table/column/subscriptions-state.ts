import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import { escapeIdentifier } from '../../../escaping.js';
import type { SelectExpression } from '../../../statement/manipulation/clause/select-expression.js';
import type { TableReference } from '../../../statement/manipulation/clause/table-reference.js';
import {
  AND,
  type WhereCondition,
} from '../../../statement/manipulation/clause/where-condition.js';
import { Event } from '../../event.js';
import type { Table } from '../../table.js';
import { AbstractColumn } from '../abstract-column.js';
import { JsonType, TimestampType, UuidType } from '../data-type.js';

export * from './subscriptions-state/diagnosis.js';

export type SubscriptionsStateColumnOptions = {
  /**
   * Enables changes-subscriptions state tracking for optimized cache invalidation.
   *
   * When enabled, adds a JSON column to store timestamps of when each subscription
   * was last revalidated. This allows the system to:
   * - Skip unnecessary updates when data hasn't changed
   * - Efficiently determine which subscriptions need refresh
   * - Reduce load on both database and application servers
   *
   * @default false
   */
  enabled?: utils.OptionalFlag;

  /**
   * Optional, the name of the column
   *
   * @default _gp_subscriptions_state
   */
  name?: string;

  /**
   * Optional, the name of the event that will be used to clean up the subscriptions' state
   *
   * @default _gp_{tableName}_subscriptions_state_janitor
   */
  janitor?: string;

  /**
   * Optional, the number of seconds to keep the subscriptions' state (= its last revalidated timestamp)
   *
   * @default 60 * 60 * 24 (1 day)
   */
  retention?: number;
};

/**
 * Store the changes-subscriptions' state as a JSON object, as a record structured as:
 *
 * ```json
 * {
 *   [subscriptionId]: revalidatedAt,
 *   ...
 * }
 * ```
 */
export class SubscriptionsStateColumn extends AbstractColumn {
  public readonly name: string;
  public readonly comment = "Store the changes-subscriptions' state";
  public readonly dataType = new JsonType();
  public readonly subscriptionIdDataType = new UuidType();
  public readonly revalidatedAtDataType = new TimestampType({
    microsecondPrecision: 3,
  });
  public readonly retentionInSeconds: number;

  public constructor(
    table: Table,
    public readonly options?: SubscriptionsStateColumnOptions,
  ) {
    super(table);

    this.name = options?.name || '_gp_subscriptions_state';
    this.retentionInSeconds = options?.retention || 60 * 60 * 24;
  }

  @MGetter
  public get janitor(): Event {
    return new Event(
      this.table.schema,
      this.options?.janitor ??
        `_gp_${this.table.name}_subscriptions_state_janitor`,
      `EVERY ${Math.round(this.retentionInSeconds / 2)} SECOND`,
      `
        UPDATE ${escapeIdentifier(this.table.qualifiedName)}
          SET ${escapeIdentifier(this.name)} = (
            SELECT JSON_OBJECTAGG(${escapeIdentifier(`t.id`)}, ${escapeIdentifier(`t.revalidatedAt`)})
            FROM JSON_TABLE(
              JSON_KEY_VALUE(${escapeIdentifier(this.name)}, '$'),
              '$[*]' COLUMNS (
                ${escapeIdentifier(`id`)} CHAR(36) PATH '$.key' ERROR ON EMPTY,
                ${escapeIdentifier(`revalidatedAt`)} TIMESTAMP(3) PATH '$.value' ERROR ON EMPTY
              )
            ) t
            WHERE ${escapeIdentifier(`t.revalidatedAt`)} >= NOW(3) - INTERVAL ${this.retentionInSeconds} SECOND
          )
        WHERE ${escapeIdentifier(this.name)} IS NOT NULL
      `,
    );
  }

  public select(tableReference: TableReference): SelectExpression {
    return this.table.primaryKey.columns
      .map((column) => tableReference.getEscapedColumnIdentifier(column))
      .join(',');
  }

  public filter(
    tableReference: TableReference,
    {
      id,
      ifModifiedSince,
      maxAge,
    }: core.ChangesSubscriptionCacheControlInputValue,
  ): WhereCondition {
    return AND([
      `IFNULL(
        JSON_VALUE(${tableReference.getEscapedColumnIdentifier(this)}, '$."${id}"') < ${this.revalidatedAtDataType.serialize(ifModifiedSince)},
        TRUE
      )`,
      maxAge != null
        ? `IFNULL(
          JSON_VALUE(${tableReference.getEscapedColumnIdentifier(this)}, '$."${id}"') < NOW(3) - INTERVAL ${maxAge} SECOND,
          TRUE
        )`
        : undefined,
    ]);
  }
}
