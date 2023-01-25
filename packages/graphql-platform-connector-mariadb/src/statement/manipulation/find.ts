import type * as core from '@prismamedia/graphql-platform';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { escapeIdentifier } from '../../escaping.js';
import type { Table } from '../../schema.js';
import { StatementKind } from '../kind.js';
import { orderNode } from './clause/ordering-expression.js';
import { selectNode } from './clause/select-expression.js';
import { TableFactor } from './clause/table-reference.js';
import { filterNode } from './clause/where-condition.js';

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class FindStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    statement: core.ConnectorFindStatement,
    context: core.OperationContext,
  ) {
    const tableReference = new TableFactor(table, context);

    const selectExpression = `${selectNode(
      tableReference,
      statement.selection,
    )} as ${escapeIdentifier(table.node.name)}`;

    const whereCondition = statement.filter
      ? filterNode(tableReference, statement.filter)
      : undefined;

    const orderingExpressions = statement.ordering
      ? orderNode(tableReference, statement.ordering)
      : undefined;

    const limit = statement.limit;

    const offset = statement.offset;

    this.sql = [
      `SELECT ${selectExpression}`,
      `FROM ${tableReference}`,
      whereCondition && `WHERE ${whereCondition}`,
      orderingExpressions && `ORDER BY ${orderingExpressions}`,
      `LIMIT ${limit}`,
      offset && `OFFSET ${offset}`,
      statement.forMutation && 'FOR UPDATE',
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
