import type * as mariadb from 'mariadb';
import assert from 'node:assert';
import { EOL } from 'node:os';
import * as R from 'remeda';
import { escapeIdentifier } from '../../escaping.js';
import { ForeignKey, Table } from '../../schema/table.js';
import { StatementKind } from '../kind.js';

/**
 * @see https://mariadb.com/kb/en/alter-table/
 */
export class DropTableForeignKeysStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_DEFINITION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    foreignKeys?: true | ReadonlyArray<ForeignKey['name'] | ForeignKey>,
  ) {
    const actualForeignKeys = R.filter(
      foreignKeys == null || foreignKeys === true
        ? table.foreignKeys
        : foreignKeys.map((foreignKeyOrName) =>
            foreignKeyOrName instanceof ForeignKey
              ? foreignKeyOrName
              : table.foreignKeys.find(({ name }) => name === foreignKeyOrName),
          ),
      R.isDefined,
    );

    assert(actualForeignKeys.length > 0);

    this.sql = [
      `ALTER TABLE ${escapeIdentifier(table.qualifiedName)}`,
      actualForeignKeys
        .map(({ name }) => `DROP FOREIGN KEY ${escapeIdentifier(name)}`)
        .join(`,${EOL}`),
    ].join(EOL);
  }
}
