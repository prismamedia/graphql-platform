import type * as mariadb from 'mariadb';
import assert from 'node:assert/strict';
import { EOL } from 'node:os';
import { escapeIdentifier } from '../../escaping.js';
import { ForeignKey, type Table } from '../../schema.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class DropTableForeignKeysStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    foreignKeys: ReadonlyArray<ForeignKey | ForeignKey['name']>,
  ) {
    assert(foreignKeys.length > 0);

    this.sql = [
      `ALTER TABLE ${escapeIdentifier(table.qualifiedName)}`,
      foreignKeys
        .map(
          (foreignKey) =>
            `DROP FOREIGN KEY ${escapeIdentifier(
              foreignKey instanceof ForeignKey ? foreignKey.name : foreignKey,
            )}`,
        )
        .join(`,${EOL}`),
    ].join(EOL);
  }
}
