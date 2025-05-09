import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import { escapeIdentifier } from '../../../escaping.js';
import type { MariaDBConnector } from '../../../index.js';
import { ensureIdentifierName } from '../../naming-strategy.js';
import type { Column, Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';

export * from './unique/diagnosis.js';

export interface UniqueIndexConfig {
  /**
   * Optional, the index's name
   */
  name?: utils.Nillable<string>;
}

/**
 * @see https://mariadb.com/kb/en/getting-started-with-indexes/#unique-index
 */
export class UniqueIndex extends AbstractIndex {
  public readonly config?: UniqueIndexConfig;
  public readonly configPath: utils.Path;

  public constructor(
    table: Table,
    public readonly uniqueConstraint: core.UniqueConstraint<MariaDBConnector>,
  ) {
    assert(
      !uniqueConstraint.isMainIdentifier(),
      `The "${uniqueConstraint}" unique-constraint is the identifier`,
    );

    super(table);

    // config
    {
      this.config = uniqueConstraint.config.index;
      this.configPath = utils.addPath(uniqueConstraint.configPath, 'index');

      utils.assertNillablePlainObject(this.config, this.configPath);
    }
  }

  @MGetter
  public override get columns(): ReadonlyArray<Column> {
    return this.table.getColumnsByComponents(
      ...this.uniqueConstraint.componentsByName.values(),
    );
  }

  @MGetter
  public override get name(): string {
    const nameConfig = this.config?.name;
    const nameConfigPath = utils.addPath(this.configPath, 'name');

    return nameConfig
      ? ensureIdentifierName(nameConfig, nameConfigPath)
      : this.table.schema.namingStrategy.getUniqueIndexName(this);
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#unique
   */
  @MGetter
  public override get definition(): string {
    return `UNIQUE INDEX ${escapeIdentifier(this.name)} (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
