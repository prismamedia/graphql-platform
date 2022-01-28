import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import { AbstractStatement, OkPacket } from '../abstract-statement.js';
import { escapeIdentifier } from '../escape.js';
import type { Table } from '../schema/table.js';

export interface AddTableForeignKeysStatementConfig {}

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class AddTableForeignKeysStatement extends AbstractStatement<OkPacket> {
  public readonly statement: string;

  public constructor(
    table: Table,
    config?: AddTableForeignKeysStatementConfig,
  ) {
    assert(
      table.foreignKeysByEdge.size > 0,
      `There is no foreign-key in the table "${table}"`,
    );

    super(table.schema.connector);

    this.statement = [
      `ALTER TABLE ${escapeIdentifier(table.qualifiedName)}`,
      Array.from(
        table.foreignKeysByEdge.values(),
        ({ definition }) => `ADD ${definition}`,
      ).join(`,${EOL}`),
    ].join(EOL);
  }
}
