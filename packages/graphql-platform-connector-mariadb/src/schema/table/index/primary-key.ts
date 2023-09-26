import * as core from '@prismamedia/graphql-platform';
import { Memoize } from '@prismamedia/memoize';

import assert from 'node:assert/strict';
import { escapeIdentifier } from '../../../escaping.js';
import type { MariaDBConnector } from '../../../index.js';
import { ensureIdentifierName } from '../../naming-strategy.js';
import type { Column, Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';

export * from './primary-key/diagnosis.js';

/**
 * @see https://mariadb.com/kb/en/getting-started-with-indexes/#primary-key
 */
export class PrimaryKey extends AbstractIndex {
  public override readonly name: string;

  public constructor(
    table: Table,
    public readonly uniqueConstraint: core.UniqueConstraint<MariaDBConnector>,
  ) {
    assert(
      uniqueConstraint.isMainIdentifier(),
      `The "${uniqueConstraint}" unique-constraint is not the identifier`,
    );

    super(table);

    // name
    {
      this.name = ensureIdentifierName('PRIMARY');
    }
  }

  @Memoize()
  public override get columns(): ReadonlyArray<Column> {
    return Object.freeze(
      this.table.getColumnsByComponents(
        ...this.uniqueConstraint.componentsByName.values(),
      ),
    );
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#primary-key
   */
  @Memoize()
  public override get definition(): string {
    return `PRIMARY KEY (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
