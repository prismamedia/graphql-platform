import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import type { SetOptional } from 'type-fest';
import { escapeIdentifier } from '../../escaping.js';
import { LeafColumn, type Table } from '../../schema.js';
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
  public readonly mutationType = utils.MutationType.CREATION;
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    public readonly context: core.MutationContext,
    statement: SetOptional<core.ConnectorCreateStatement, 'node'>,
    config?: InsertStatementConfig,
  ) {
    this.sql = [
      [
        'INSERT',
        config?.ignore && 'IGNORE',
        `INTO ${escapeIdentifier(table.name)}`,
      ]
        .filter(Boolean)
        .join(' '),
      `  (${table.columns.map(({ name }) => escapeIdentifier(name)).join(',')})`,
      'VALUES',
      statement.creations
        .map(
          (creation) =>
            `  (${table.columns
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
      `  ${table.columns.map(({ name }) => escapeIdentifier(name)).join(',')}`,
    ].join(EOL);
  }
}
