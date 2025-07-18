import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import type * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import type { SetOptional } from 'type-fest';
import { escapeIdentifier } from '../../escaping.js';
import { Table } from '../../schema.js';
import { StatementKind } from '../kind.js';
import { TableFactor } from './clause/table-reference.js';
import { filterNode } from './clause/where-condition.js';

export interface DeleteStatementConfig {
  /**
   * @see https://mariadb.com/kb/en/ignore/
   */
  ignore?: boolean;
}

/**
 * @see https://mariadb.com/kb/en/delete/
 */
export class DeleteStatement implements mariadb.QueryOptions {
  public readonly mutationType = utils.MutationType.DELETION;
  public readonly kind = StatementKind.DATA_MANIPULATION;
  public readonly sql: string;

  public constructor(
    public readonly table: Table,
    public readonly context: core.MutationContext,
    statement: SetOptional<core.ConnectorDeleteStatement, 'node'>,
    config?: DeleteStatementConfig,
  ) {
    const tableReference = new TableFactor(table, { context });

    const whereCondition = filterNode(tableReference, statement.filter);

    this.sql = [
      [
        'DELETE',
        config?.ignore === true && 'IGNORE',
        escapeIdentifier(tableReference.alias),
      ]
        .filter(Boolean)
        .join(' '),
      `FROM ${tableReference}`,
      `WHERE ${whereCondition}`,
    ].join(EOL);
  }
}
