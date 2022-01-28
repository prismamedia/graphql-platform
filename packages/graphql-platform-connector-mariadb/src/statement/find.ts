import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { EOL } from 'node:os';
import { AbstractStatement } from '../abstract-statement.js';
import type { Table } from '../schema.js';
import { WhereClause } from './clause/where.js';

export interface FindStatementConfig {}

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class FindStatement<
  TTuple extends utils.PlainObject,
> extends AbstractStatement<TTuple[]> {
  protected readonly where: WhereClause | undefined;

  public constructor(
    table: Table,
    { selection, where }: core.ConnectorFindStatement,
    protected readonly config?: FindStatementConfig,
  ) {
    super(table.schema.connector);

    this.where = where?.normalized
      ? new WhereClause(where?.normalized)
      : undefined;
  }

  @Memoize()
  public override get statement(): string {
    return [
      `SELECT *`,
      `FROM ${this.table.qualifiedName}`,
      this.where && `WHERE ${this.where}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
