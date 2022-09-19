import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { EOL } from 'node:os';
import { AbstractStatement } from '../abstract-statement.js';
import type { Table } from '../schema.js';
import { TableFactor } from './clause/table-reference.js';
import type { WhereClause } from './clause/where.js';

export interface AbstractSelectStatementConfig {}

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export abstract class AbstractSelectStatement<
  TTuple extends utils.PlainObject[],
> extends AbstractStatement<TTuple> {
  protected abstract readonly select: string;

  /**
   * @see https://mariadb.com/kb/en/join-syntax/
   */
  protected readonly from: TableFactor;
  protected readonly where?: WhereClause;

  public constructor(
    public readonly table: Table,
    protected readonly config?: AbstractSelectStatementConfig,
  ) {
    super(table.schema.connector);

    this.from = new TableFactor(table);
  }

  @Memoize()
  public override get statement(): string {
    return [
      `SELECT ${this.select}`,
      `FROM ${this.from}`,
      this.where && `WHERE ${this.where}`,
    ]
      .filter(Boolean)
      .join(EOL);
  }
}
