import { Component, ComponentSet } from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { escapeId } from 'mysql';
import { Table } from '../table';
import { ColumnSet } from './column/set';

export * from './unique-index/set';

export enum ColumnIndexKind {
  // default
  // cf: https://mariadb.com/kb/en/library/getting-started-with-indexes/#plain-indexes
  Plain,
  // cf: https://mariadb.com/kb/en/library/getting-started-with-indexes/#full-text-indexes
  FullText,
  // cf: https://mariadb.com/kb/en/library/spatial-index/
  Spatial,
}

/**
 * cf: https://mariadb.com/kb/en/library/create-index/
 */
export interface ColumnIndexConfig {
  /** Optional, the index's name, default: guessed from column's name */
  name?: Maybe<string>;

  /** Optional, the index's kind, default: Plain */
  kind?: Maybe<ColumnIndexKind>;

  /** Required, the index components' name */
  components: Component['name'][];
}

export class ColumnIndex {
  readonly config: ColumnIndexConfig;

  public constructor(
    readonly table: Table,
    config: ColumnIndexConfig | ColumnIndexConfig['components'],
  ) {
    this.config = Array.isArray(config) ? { components: config } : config;
  }

  @Memoize()
  public get kind(): ColumnIndexKind {
    return this.config.kind || ColumnIndexKind.Plain;
  }

  @Memoize()
  public getComponentSet(): ComponentSet {
    const componentSet = new ComponentSet();
    if (Array.isArray(this.config.components)) {
      for (const componentName of this.config.components) {
        componentSet.add(
          this.table.resource.getComponentMap().assert(componentName),
        );
      }
    }

    if (componentSet.size === 0) {
      throw new Error(`A "column index" has to contain at least 1 component`);
    }

    return componentSet;
  }

  @Memoize()
  public getColumnSet(): ColumnSet {
    return this.table.getComponentSetColumnSet(this.getComponentSet());
  }

  @Memoize()
  public get name(): string {
    return (
      (
        this.config.name ||
        ['idx', ...[...this.getColumnSet()].map(({ name }) => name)].join('_')
      )
        // cf: https://dev.mysql.com/doc/refman/8.0/en/identifiers.html
        .substr(0, 64)
    );
  }

  public getEscapedName(alias?: string): string {
    return [alias, this.name]
      .map((value) => (value ? escapeId(value) : null))
      .filter(Boolean)
      .join('.');
  }
}
