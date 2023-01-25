import type * as core from '@prismamedia/graphql-platform';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import type { Table } from '../../schema.js';
import { StatementKind } from '../kind.js';
import { TableFactor } from './clause/table-reference.js';
import { filterNode } from './clause/where-condition.js';

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class CountStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    statement: core.ConnectorCountStatement,
    context: core.OperationContext,
  ) {
    const tableReference = new TableFactor(table, context);

    const whereCondition = statement.filter
      ? filterNode(tableReference, statement.filter)
      : undefined;

    this.sql = [
      'SELECT COUNT(*) AS COUNT',
      `FROM ${tableReference}`,
      whereCondition && `WHERE ${whereCondition}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
