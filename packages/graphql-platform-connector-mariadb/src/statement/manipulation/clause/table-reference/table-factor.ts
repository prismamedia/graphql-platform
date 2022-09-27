import type * as core from '@prismamedia/graphql-platform';
import { escapeIdentifier } from '../../../../escaping.js';
import type { Table } from '../../../../schema.js';
import { AbstractTableReference } from '../abstract-table-reference.js';

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class TableFactor extends AbstractTableReference {
  public override readonly alias: string;
  public override readonly depth: number = 0;

  public constructor(table: Table, context: core.OperationContext) {
    super(table, context);

    this.alias = table.name;
  }

  public override toString(): string {
    return [
      `${escapeIdentifier(this.table.name)}${
        this.alias === this.table.name
          ? ''
          : ` AS ${escapeIdentifier(this.alias)}`
      }`,
      ...Array.from(this.joinsByAlias.values(), (joinTable) =>
        joinTable.toString(),
      ),
    ].join(' ');
  }
}
