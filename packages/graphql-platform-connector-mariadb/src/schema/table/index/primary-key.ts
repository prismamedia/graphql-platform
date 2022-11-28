import * as core from '@prismamedia/graphql-platform';
import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import { escapeIdentifier } from '../../../escaping.js';
import type { MariaDBConnector } from '../../../index.js';
import type { Column, Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';

/**
 * @see https://mariadb.com/kb/en/getting-started-with-indexes/#primary-key
 */
export class PrimaryKey extends AbstractIndex {
  public readonly name: string;

  public constructor(
    table: Table,
    public readonly uniqueConstraint: core.UniqueConstraint<
      any,
      MariaDBConnector
    >,
  ) {
    assert(
      uniqueConstraint.isIdentifier(),
      `The "${uniqueConstraint}" unique-constraint is not the identifier`,
    );

    super(table);

    // name
    {
      this.name = 'PRIMARY KEY';
    }
  }

  @Memoize()
  public get columns(): ReadonlyArray<Column> {
    return Object.freeze(
      this.table.getColumnsByComponents(...this.uniqueConstraint.components),
    );
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#primary-key
   */
  @Memoize()
  public get definition(): string {
    return `PRIMARY KEY (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
