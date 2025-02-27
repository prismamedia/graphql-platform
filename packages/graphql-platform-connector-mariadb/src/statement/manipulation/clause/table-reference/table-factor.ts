import type * as core from '@prismamedia/graphql-platform';
import assert from 'node:assert';
import { escapeIdentifier } from '../../../../escaping.js';
import type { Table } from '../../../../schema.js';
import { AbstractTableReference } from '../abstract-table-reference.js';
import { JoinSubscriptionsStateTable } from './join-subscriptions-state-table.js';

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class TableFactor extends AbstractTableReference {
  #joinSubscriptionsStateTable?: JoinSubscriptionsStateTable;

  public constructor(
    table: Table,
    context: core.OperationContext,
    public override readonly alias: string = table.name,
    public override readonly depth: number = 0,
  ) {
    super(table, context);
  }

  public override toString(): string {
    return [
      `${escapeIdentifier(this.table.name)}${
        this.alias === this.table.name
          ? ''
          : ` AS ${escapeIdentifier(this.alias)}`
      }`,
      ...Array.from(this.joinsByAlias.values(), (join) => join.toString()),
      this.#joinSubscriptionsStateTable?.toString(),
    ]
      .filter(Boolean)
      .join(' ');
  }

  public joinSubscriptionsState(
    subscriptionId: core.ChangesSubscriptionStream['id'],
  ): JoinSubscriptionsStateTable {
    let joinSubscriptionsStateTable = this.#joinSubscriptionsStateTable;
    if (joinSubscriptionsStateTable) {
      assert.strictEqual(
        joinSubscriptionsStateTable.subscriptionId,
        subscriptionId,
      );

      return joinSubscriptionsStateTable;
    }

    assert(
      this.table.subscriptionsStateTable,
      `The table "${this.table.name}" has no "subscriptions' state" table`,
    );

    assert.strictEqual(
      this.depth,
      0,
      `The "subscriptions' state" table is only available for root-table`,
    );

    return (this.#joinSubscriptionsStateTable ??=
      new JoinSubscriptionsStateTable(
        this,
        this.table.subscriptionsStateTable,
        subscriptionId,
      ));
  }
}
