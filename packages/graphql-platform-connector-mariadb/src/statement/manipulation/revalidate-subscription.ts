import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import { escapeIdentifier } from '../../escaping.js';
import type { Table } from '../../schema.js';
import { StatementKind } from '../kind.js';
import { AND, OR, type WhereCondition } from './clause/where-condition.js';

export class RevalidateSubscriptionStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    rows: ReadonlyArray<utils.PlainObject>,
    { id }: core.ChangesSubscriptionCacheControlInputValue,
    revalidatedAt: Date,
  ) {
    assert(table.subscriptionsStateColumn);

    let where: WhereCondition;

    if (table.primaryKey.columns.length === 1) {
      const column = table.primaryKey.columns[0];

      where = `${escapeIdentifier(column.name)} IN (${rows.map((row) => column.dataType.serialize(column.pickLeafValueFromRow(row))).join(',')})`;
    } else {
      where = OR(
        rows.map((row) =>
          AND(
            table.primaryKey.columns.map(
              (column) =>
                `${escapeIdentifier(column.name)} = ${column.dataType.serialize(column.pickLeafValueFromRow(row))}`,
            ),
          ),
        ),
      );
    }

    this.sql = `
      UPDATE ${escapeIdentifier(this.table.name)}
      SET ${escapeIdentifier(table.subscriptionsStateColumn.name)} = JSON_SET(
        COALESCE(${escapeIdentifier(table.subscriptionsStateColumn.name)}, '{}'),
        '$."${id}"',
        ${table.subscriptionsStateColumn.revalidatedAtDataType.serialize(revalidatedAt)}
      )
      WHERE ${where}
    `;
  }
}
