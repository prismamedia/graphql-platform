import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { escapeIdentifier } from '../../../escaping.js';
import type { Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';
import type { Column } from '../column.js';

export interface PlainIndexConfig {
  /**
   * Optional, the index's name
   */
  name?: utils.Nillable<string>;

  /**
   * Required, the index's columns' name
   */
  columns: ReadonlyArray<Column['name']>;
}

/**
 * @see https://mariadb.com/kb/en/getting-started-with-indexes/#plain-indexes
 */
export class PlainIndex extends AbstractIndex {
  public constructor(
    table: Table,
    public readonly config: PlainIndexConfig,
    public readonly configPath: utils.Path,
  ) {
    utils.assertPlainObjectConfig(config, configPath);

    super(table);
  }

  @Memoize()
  public get columns(): ReadonlyArray<Column> {
    const config = this.config.columns;
    const configPath = utils.addPath(this.configPath, 'columns');

    return Object.freeze(
      config.map((columnName, index) => {
        const column = this.table.columns.find(
          (column) => column.name === columnName,
        );

        if (!column) {
          throw new utils.UnexpectedConfigError(
            'an existing column',
            columnName,
            { path: utils.addPath(configPath, index) },
          );
        }

        return column;
      }),
    );
  }

  @Memoize()
  public get name(): string {
    const config = this.config?.name;
    const configPath = utils.addPath(this.configPath, 'name');

    if (config) {
      if (typeof config !== 'string') {
        throw new utils.UnexpectedConfigError('a string', config, {
          path: configPath,
        });
      }

      if (config.length > 64) {
        throw new utils.UnexpectedConfigError(
          'an identifier shorter than 64 characters',
          config,
          { path: configPath },
        );
      }

      return config;
    } else if (this.table.schema.config?.naming?.plainIndex) {
      return this.table.schema.config.naming.plainIndex(
        this.table.name,
        this.columns,
      );
    }

    return (
      ['idx', ...this.columns.map(({ name }) => name)]
        .join('_')
        // @see https://mariadb.com/kb/en/identifier-names/#maximum-length
        .substring(0, 64)
    );
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#plain-indexes
   */
  @Memoize()
  public get definition(): string {
    return `INDEX ${escapeIdentifier(this.name)} (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
