import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
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
   * Required, the index's components' name
   */
  components: ReadonlyArray<core.Component['name']>;
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
    const config = this.config.components;
    const configPath = utils.addPath(this.configPath, 'components');

    return Object.freeze(
      config.flatMap((componentName, index) => {
        const component = this.table.node.getComponentByName(
          componentName,
          utils.addPath(configPath, index),
        );

        return this.table.getColumnsByComponents(component);
      }),
    );
  }

  @Memoize()
  public get name(): string {
    const config = this.config?.name;
    const configPath = utils.addPath(this.configPath, 'name');

    if (config) {
      if (typeof config !== 'string') {
        throw new utils.UnexpectedValueError('a string', config, {
          path: configPath,
        });
      }

      if (config.length > 64) {
        throw new utils.UnexpectedValueError(
          'an identifier shorter than 64 characters',
          config,
          { path: configPath },
        );
      }

      return config;
    }

    return this.table.schema.namingStrategy.getPlainIndexName(
      this.table.name,
      this.columns,
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
