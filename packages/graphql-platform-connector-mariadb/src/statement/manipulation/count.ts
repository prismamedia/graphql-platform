import type * as core from '@prismamedia/graphql-platform';
import type { SetOptional } from 'type-fest';
import { escapeIdentifier } from '../../escaping.js';
import type { Table } from '../../schema.js';
import { SelectStatement } from './select.js';

export class CountStatement extends SelectStatement {
  public readonly selectionKey: string;

  public constructor(
    public readonly table: Table,
    public readonly context: core.OperationContext,
    statement: SetOptional<core.ConnectorCountStatement, 'node'>,
  ) {
    const selectionKey = `COUNT`;

    super(table, context, {
      select: `COUNT(*) AS ${escapeIdentifier(selectionKey)}`,
      where: statement.filter,
    });

    this.selectionKey = selectionKey;
  }
}
