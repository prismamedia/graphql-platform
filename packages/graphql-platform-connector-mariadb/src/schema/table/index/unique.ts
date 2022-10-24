import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import { escapeIdentifier } from '../../../escaping.js';
import type { MariaDBConnector } from '../../../index.js';
import type { Column, Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';

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
    public readonly uniqueConstraint: core.UniqueConstraint<
      any,
      MariaDBConnector
    >,
  ) {
    assert(
      !uniqueConstraint.isIdentifier(),
      `The "${uniqueConstraint}" unique-constraint is the identifier`,
    );

    super(table);

    // config
    {
      this.config = uniqueConstraint.config.index;
      this.configPath = utils.addPath(uniqueConstraint.configPath, 'index');

      utils.assertNillablePlainObjectConfig(this.config, this.configPath);
    }
  }

  @Memoize()
  public get name(): string {
    const nameConfig = this.config?.name;
    const nameConfigPath = utils.addPath(this.configPath, 'name');

    if (nameConfig) {
      if (typeof nameConfig !== 'string') {
        throw new utils.UnexpectedConfigError('a string', nameConfig, {
          path: nameConfigPath,
        });
      }

      if (nameConfig.length > 64) {
        throw new utils.UnexpectedConfigError(
          'an identifier shorter than 64 characters',
          nameConfig,
          { path: nameConfigPath },
        );
      }

      return nameConfig;
    } else if (this.table.schema.config?.naming?.uniqueIndex) {
      return this.table.schema.config.naming.uniqueIndex(
        this.table.name,
        this.uniqueConstraint,
      );
    }

    return (
      ['unq', inflection.underscore(this.uniqueConstraint.name)]
        .join('_')
        // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
        .substring(0, 64)
    );
  }

  @Memoize()
  public get columns(): ReadonlyArray<Column> {
    return Object.freeze(
      this.table.getColumnsByComponents(
        ...this.uniqueConstraint.componentsByName.values(),
      ),
    );
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#unique
   */
  @Memoize()
  public get definition(): string {
    return `UNIQUE ${escapeIdentifier(this.name)} (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
