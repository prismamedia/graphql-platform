import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import { escapeIdentifier } from '../../escaping.js';
import type { Table } from '../../schema/table.js';
import { StatementKind } from '../kind.js';

export interface AddTableForeignKeysStatementConfig {}

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class AddTableForeignKeysStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    config?: AddTableForeignKeysStatementConfig,
  ) {
    assert(
      table.foreignKeyIndexesByEdge.size > 0,
      `There is no foreign-key in the table "${table}"`,
    );

    this.sql = [
      `ALTER TABLE ${escapeIdentifier(table.qualifiedName)}`,
      Array.from(
        table.foreignKeyIndexesByEdge.values(),
        ({ definition }) => `ADD ${definition}`,
      ).join(`,${EOL}`),
    ].join(EOL);
  }
}
