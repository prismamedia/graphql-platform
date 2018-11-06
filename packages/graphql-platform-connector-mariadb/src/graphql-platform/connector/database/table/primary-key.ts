import { Unique } from '@prismamedia/graphql-platform-core';
import { Memoize } from 'typescript-memoize';
import { Table } from '../table';
import { ColumnSet } from './column/set';

export class PrimaryKey {
  public constructor(readonly table: Table, readonly unique: Unique) {}

  @Memoize()
  public getColumnSet(): ColumnSet {
    return this.table.getComponentSetColumnSet(this.unique.componentSet);
  }
}
