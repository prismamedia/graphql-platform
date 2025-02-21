import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { SelectExpression } from '../../../statement/manipulation/clause/select-expression.js';
import type { TableReference } from '../../../statement/manipulation/clause/table-reference.js';
import type { WhereCondition } from '../../../statement/manipulation/clause/where-condition.js';
import type { Table } from '../../table.js';
import { AbstractColumn } from '../abstract-column.js';
import { JsonType, TimestampType, UuidType } from '../data-type.js';

export * from './subscriptions-state/diagnosis.js';

export type SubscriptionsStateColumnConfig = {
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
   * @default `_gp_subscriptions_state`
   */
  name?: string;

  /**
   * Optional, the number of seconds to keep the state of a subscription (= its last revalidated timestamp)
   *
   * @default `60 * 60 * 6 (6 hours)`
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

  public constructor(table: Table, config?: SubscriptionsStateColumnConfig) {
    super(table);

    this.name = config?.name || '_gp_subscriptions_state';
    this.retentionInSeconds = config?.retention || 60 * 60 * 6;
  }

  public select(tableReference: TableReference): SelectExpression {
    return this.table.primaryKey.columns
      .map((column) => tableReference.getEscapedColumnIdentifier(column))
      .join(',');
  }

  public filter(
    tableReference: TableReference,
    { id, ifModifiedSince }: core.ChangesSubscriptionCacheControlInputValue,
  ): WhereCondition {
    return `IFNULL(
      JSON_VALUE(${tableReference.getEscapedColumnIdentifier(this)}, '$."${id}"') <= ${this.revalidatedAtDataType.serialize(ifModifiedSince)},
      TRUE
    )`;
  }
}
