import { MGetter } from '@prismamedia/memoize';
import { escapeIdentifier } from '../../../escaping.js';
import type { Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';
import { LeafColumn } from '../column/leaf.js';

export * from './full-text/diagnosis.js';

/**
 * @see https://mariadb.com/kb/en/full-text-indexes/
 */
export class FullTextIndex extends AbstractIndex {
  public override readonly name: string;

  public constructor(
    table: Table,
    public override readonly columns: ReadonlyArray<LeafColumn>,
  ) {
    super(table);

    this.name = this.table.schema.namingStrategy.getFullTextIndexName(this);
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#fulltext
   */
  @MGetter
  public override get definition(): string {
    return `FULLTEXT ${escapeIdentifier(this.name)} (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
