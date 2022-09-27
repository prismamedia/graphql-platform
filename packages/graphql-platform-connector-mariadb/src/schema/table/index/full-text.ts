import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import { escapeIdentifier } from '../../../escaping.js';
import type { LeafColumn } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';

/**
 * @see https://mariadb.com/kb/en/full-text-index-overview/
 */
export class FullTextIndex extends AbstractIndex {
  public readonly name: string;

  public constructor(public readonly column: LeafColumn) {
    super(column.table);

    this.name = `txt_${inflection.underscore(column.name)}`
      // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
      .substring(0, 64);
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#unique
   */
  @Memoize()
  public get definition(): string {
    return `FULLTEXT ${escapeIdentifier(this.name)} (${escapeIdentifier(
      this.column.name,
    )})`;
  }
}
