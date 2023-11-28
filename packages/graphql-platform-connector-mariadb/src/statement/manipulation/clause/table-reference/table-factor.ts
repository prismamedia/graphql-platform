import type * as core from '@prismamedia/graphql-platform';
import { escapeIdentifier } from '../../../../escaping.js';
import type { Table } from '../../../../schema.js';
import { AbstractTableReference } from '../abstract-table-reference.js';

/**
 * @see https://mariadb.com/kb/en/join-syntax/
 */
export class TableFactor extends AbstractTableReference {
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
      ...Array.from(this.joinsByAlias.values(), (joinTable) =>
        joinTable.toString(),
      ),
    ].join(' ');
  }
}
