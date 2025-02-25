import type * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import { escapeIdentifier } from '../../../escaping.js';
import { ensureIdentifierName } from '../../naming-strategy.js';
import type { Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';
import type { Column } from '../column.js';

export * from './plain/diagnosis.js';

export type PlainIndexConfig = {
  /**
   * Optional, the index's name
   */
  name?: utils.Nillable<string>;
} & (
  | {
      /**
       * Required, the index's components' name
       */
      components: ReadonlyArray<core.Component['name']>;
    }
  | {
      /**
       * Required, the index's columns' name
       */
      columns: ReadonlyArray<Column['name']>;
    }
);

/**
 * @see https://mariadb.com/kb/en/getting-started-with-indexes/#plain-indexes
 */
export class PlainIndex extends AbstractIndex {
  public constructor(
    table: Table,
    public readonly config: PlainIndexConfig,
    public readonly configPath: utils.Path,
  ) {
    utils.assertPlainObject(config, configPath);

    super(table);
  }

  @MGetter
  public override get columns(): ReadonlyArray<Column> {
    if ('columns' in this.config) {
      return Object.freeze(
        this.config.columns.map((columnName) =>
          this.table.getColumnByName(columnName),
        ),
      );
    }

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

  @MGetter
  public get name(): string {
    const nameConfig = this.config?.name;
    const nameConfigPath = utils.addPath(this.configPath, 'name');

    return nameConfig
      ? ensureIdentifierName(nameConfig, nameConfigPath)
      : this.table.schema.namingStrategy.getPlainIndexName(this);
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#plain-indexes
   */
  @MGetter
  public override get definition(): string {
    return `INDEX ${escapeIdentifier(this.name)} (${this.columns
      .map(({ name }) => escapeIdentifier(name))
      .join(',')})`;
  }
}
