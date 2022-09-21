import { EOL } from 'node:os';
import { escapeIdentifier } from '../../../escape.js';
import type { Table } from '../../../schema.js';
import { AbstractTableReference } from '../abstract-table-reference.js';

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class TableFactor extends AbstractTableReference {
  public override readonly alias: string;
  public override readonly depth: number = 0;

  public constructor(table: Table) {
    super(table);

    this.alias = table.name;
  }

  public override toString(): string {
    return [
      `${escapeIdentifier(this.table.qualifiedName)} AS ${escapeIdentifier(
        this.alias,
      )}`,
      ...Array.from(this.children.values(), (joinTable) =>
        joinTable.toIndentedString(),
      ),
    ].join(EOL);
  }
}
