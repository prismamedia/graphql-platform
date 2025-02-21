import type * as core from '@prismamedia/graphql-platform';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import type { SetOptional } from 'type-fest';
import { escapeIdentifier } from '../../escaping.js';
import {
  LeafColumn,
  SubscriptionsStateColumn,
  type Column,
  type Table,
} from '../../schema.js';
import { StatementKind } from '../kind.js';

export interface InsertStatementConfig {
  /**
   * @see https://mariadb.com/kb/en/ignore/
   */
  ignore?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/insertreturning/
 */
export class InsertStatement implements mariadb.QueryOptions {
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    _context: core.MutationContext,
    statement: SetOptional<core.ConnectorCreateStatement, 'node'>,
    config?: InsertStatementConfig,
  ) {
    const columns = table.columns.filter(
      (column): column is Exclude<Column, SubscriptionsStateColumn> =>
        !(column instanceof SubscriptionsStateColumn),
    );

    this.sql = [
      [
        'INSERT',
        config?.ignore && 'IGNORE',
        `INTO ${escapeIdentifier(table.name)}`,
      ]
        .filter(Boolean)
        .join(' '),
      `  (${columns.map(({ name }) => escapeIdentifier(name)).join(',')})`,
      'VALUES',
      statement.creations
        .map(
          (creation) =>
            `  (${columns
              .map((column) =>
                column.dataType.serialize(
                  column instanceof LeafColumn
                    ? (creation.getLeafValue(column.leaf) ?? null)
                    : column.pickLeafValueFromReferenceValue(
                        creation.getEdgeValue(column.edge) ?? null,
                      ),
                ),
              )
              .join(',')})`,
        )
        .join(`,${EOL}`),
      `RETURNING`,
      `  ${columns.map(({ name }) => escapeIdentifier(name)).join(',')}`,
    ].join(EOL);
  }
}
