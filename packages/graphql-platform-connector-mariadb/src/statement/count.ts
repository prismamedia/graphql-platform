import type * as core from '@prismamedia/graphql-platform';
import type { Table } from '../schema.js';
import { AbstractSelectStatement } from './abstract-select.js';

export interface CountStatementConfig {}

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class CountStatement extends AbstractSelectStatement<
  [{ COUNT: number }]
> {
  protected override readonly select: string = 'COUNT(*) AS COUNT';

  public constructor(
    public readonly table: Table,
    { where }: core.ConnectorCountStatement,
    protected readonly config?: CountStatementConfig,
  ) {
    super(table);
  }
}
