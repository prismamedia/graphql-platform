import { Memoize } from '@prismamedia/ts-memoize';
import { escapeIdentifier } from '../../../escaping.js';
import type { Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';
import { LeafColumn } from '../column/leaf.js';

/**
 * @see https://mariadb.com/kb/en/full-text-indexes/
 */
export class FullTextIndex extends AbstractIndex {
  public readonly name: string;

  public constructor(
    table: Table,
    public readonly columns: ReadonlyArray<LeafColumn>,
  ) {
    super(table);

    this.name = ['ft', ...this.columns.map(({ name }) => name)]
      .join('_')
      // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
      .substring(0, 64);
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#fulltext
   */
  @Memoize()
  public get definition(): string {
    return `FULLTEXT ${escapeIdentifier(this.name)} (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
