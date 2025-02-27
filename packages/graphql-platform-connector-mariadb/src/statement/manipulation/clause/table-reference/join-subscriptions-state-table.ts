import type * as core from '@prismamedia/graphql-platform';
import assert from 'node:assert';
import type { Column } from '../../../../broker/abstract-table.js';
import type { MariaDBBrokerSubscriptionsStateTable } from '../../../../broker/table/subscriptions-state.js';
import { escapeIdentifier } from '../../../../escaping.js';
import type { TableReference } from '../table-reference.js';
import { AND } from '../where-condition.js';
import { JoinTableKind } from './join-table.js';

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class JoinSubscriptionsStateTable {
  public readonly alias: string;
  public readonly depth: number;

  public constructor(
    public readonly parent: TableReference,
    public readonly table: MariaDBBrokerSubscriptionsStateTable,
    public readonly subscriptionId: core.ChangesSubscriptionStream['id'],
  ) {
    this.alias = `${parent.alias}>${table.name}`;
    this.depth = parent.depth + 1;
  }

  public toString(): string {
    const subscriptionIdColumn = this.table.getColumnByName('subscriptionId');

    return `${JoinTableKind[JoinTableKind.LEFT]} JOIN ${escapeIdentifier(
      this.table.name,
    )} AS ${escapeIdentifier(this.alias)} ON ${AND([
      ...this.table.references.map(
        ({ source, target }) =>
          `${escapeIdentifier(`${this.alias}.${source.name}`)} = ${this.parent.escapeColumnIdentifier(target)}`,
      ),
      `${escapeIdentifier(`${this.alias}.${subscriptionIdColumn.name}`)} = ${subscriptionIdColumn.dataType.serialize(this.subscriptionId)}`,
    ])}`;
  }

  public escapeColumnIdentifier(columnOrName: Column | Column['name']): string {
    const column =
      typeof columnOrName === 'string'
        ? this.table.getColumnByName(columnOrName)
        : columnOrName;
    assert(column);

    return escapeIdentifier(`${this.alias}.${column.name}`);
  }
}
