import type * as core from '@prismamedia/graphql-platform';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import type { SetOptional } from 'type-fest';
import { escapeIdentifier } from '../../escaping.js';
import type { Table } from '../../schema.js';
import { StatementKind } from '../kind.js';
import { orderNode } from './clause/ordering-expression.js';
import { selectNode } from './clause/select-expression.js';
import { TableFactor } from './clause/table-reference.js';
import { AND, filterNode } from './clause/where-condition.js';

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class FindStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;
  public readonly selectionKey: string;

  public constructor(
    public readonly table: Table,
    context: core.OperationContext,
    statement: SetOptional<core.ConnectorFindStatement, 'node'>,
  ) {
    this.selectionKey = `_${table.node.name}`;

    const tableReference = new TableFactor(table, context);

    const selectExpression = [
      `${selectNode(
        tableReference,
        statement.selection,
      )} as ${escapeIdentifier(this.selectionKey)}`,
      statement.forSubscription &&
        table.subscriptionsStateColumn?.select(tableReference),
    ]
      .filter(Boolean)
      .join(',');

    const whereCondition =
      statement.filter || statement.forSubscription
        ? AND([
            statement.filter && filterNode(tableReference, statement.filter),
            statement.forSubscription &&
              table.subscriptionsStateColumn?.filter(
                tableReference,
                statement.forSubscription,
              ),
          ])
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
      statement.forMutation != null && 'FOR UPDATE',
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
