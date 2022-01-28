import type * as core from '@prismamedia/graphql-platform';
import { Memoize } from '@prismamedia/ts-memoize';
import { EOL } from 'node:os';
import { AbstractStatement } from '../abstract-statement.js';
import type { Table } from '../schema.js';

export interface CountStatementConfig {}

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class CountStatement extends AbstractStatement<[{ COUNT: number }]> {
  protected readonly where?: core.NodeFilter;

  public constructor(
    public readonly table: Table,
    { where }: core.ConnectorCountStatement,
    protected readonly config?: CountStatementConfig,
  ) {
    super(table.schema.connector);

    this.where = where;
  }

  @Memoize()
  public override get statement(): string {
    return [`SELECT COUNT(*) AS COUNT`, `FROM ${this.table.qualifiedName}`]
      .filter(Boolean)
      .join(EOL);
  }
}
