import * as core from '@prismamedia/graphql-platform';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import { escapeIdentifier } from '../../../escaping.js';
import type { MariaDBConnector } from '../../../index.js';
import type { Table } from '../../table.js';
import { AbstractIndex } from '../abstract-index.js';
import { ReferenceColumn } from '../column/reference.js';

export interface ForeignKeyIndexConfig {
  /**
   * Optional, the index's name
   */
  name?: utils.Nillable<string>;
}

/**
 * @see https://mariadb.com/kb/en/foreign-keys/
 */
export class ForeignKeyIndex extends AbstractIndex {
  public readonly config?: ForeignKeyIndexConfig;
  public readonly configPath: utils.Path;

  public constructor(
    table: Table,
    public readonly edge: core.Edge<any, MariaDBConnector>,
  ) {
    super(table);

    // config
    {
      this.config = edge.config.foreignKey;
      this.configPath = utils.addPath(edge.configPath, 'foreignKey');

      utils.assertNillablePlainObjectConfig(this.config, this.configPath);
    }
  }

  @Memoize()
  public get referencedTable(): Table {
    return this.table.schema.getTableByNode(this.edge.head);
  }

  @Memoize()
  public get columns(): ReadonlyArray<ReferenceColumn> {
    return this.table.getColumnTreeByEdge(this.edge).columns;
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
    }

    return this.table.schema.namingStrategy.getForeignKeyIndexName(
      this.table.name,
      this.edge,
      this.columns,
    );
  }

  /**
   * @see https://mariadb.com/kb/en/create-table/#foreign-key
   */
  @Memoize()
  public get definition(): string {
    return [
      'FOREIGN KEY',
      escapeIdentifier(this.name),
      `(${this.columns.map(({ name }) => escapeIdentifier(name)).join(',')})`,
      'REFERENCES',
      escapeIdentifier(this.referencedTable.name),
      `(${this.columns
        .map(({ referencedColumn: { name } }) => escapeIdentifier(name))
        .join(',')})`,
      'ON UPDATE RESTRICT',
      'ON DELETE RESTRICT',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
