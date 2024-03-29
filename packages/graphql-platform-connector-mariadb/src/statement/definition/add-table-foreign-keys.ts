import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import { escapeIdentifier } from '../../escaping.js';
import type { ForeignKey, Table } from '../../schema/table.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class AddTableForeignKeysStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    foreignKeys: ReadonlyArray<ForeignKey>,
  ) {
    assert(foreignKeys.length > 0);

    this.sql = [
      `ALTER TABLE ${escapeIdentifier(table.qualifiedName)}`,
      foreignKeys.map(({ definition }) => `ADD ${definition}`).join(`,${EOL}`),
    ].join(EOL);
  }
}
