import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import type { Table } from '../schema.js';
import { AbstractSelectStatement } from './abstract-select.js';

export interface FindStatementConfig {}

/**
 * @see https://mariadb.com/kb/en/selecting-data/
 */
export class FindStatement<
  TTuple extends utils.PlainObject,
> extends AbstractSelectStatement<TTuple[]> {
  public constructor(
    table: Table,
    { selection, where }: core.ConnectorFindStatement,
    protected readonly config?: FindStatementConfig,
  ) {
    super(table);
  }

  protected override get select(): string {
    return '*';
  }
}
