import { Unique } from '@prismamedia/graphql-platform-core';
import { Maybe } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { escapeId } from 'mysql';
import { UniqueFullConfig } from '../../../resource';
import { Table } from '../table';
import { ColumnSet } from './column/set';

export * from './unique-index/set';

export interface UniqueIndexConfig {
  /** Optional, the unique index's name, default: unique definition's name */
  name?: Maybe<string>;
}

export class UniqueIndex {
  public constructor(
    readonly table: Table,
    readonly unique: Unique<UniqueFullConfig>,
  ) {}

  @Memoize()
  public get config(): UniqueIndexConfig {
    return (
      (this.unique.config != null &&
        !(
          typeof this.unique.config === 'string' ||
          Array.isArray(this.unique.config)
        ) &&
        this.unique.config) ||
      {}
    );
  }

  @Memoize()
  public getColumnSet(): ColumnSet {
    return this.table.getComponentSetColumnSet(this.unique.componentSet);
  }

  @Memoize()
  public get name(): string {
    return (
      (
        this.config.name ||
        ['unq', ...[...this.getColumnSet()].map(({ name }) => name)].join('_')
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
