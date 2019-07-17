import { SuperSet } from '@prismamedia/graphql-platform-utils';
import { escape } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Column, ColumnReference, Table } from '../../../table';
import { ColumnValue } from '../../column';

export type Assignment = string;

export class AssignmentSet extends SuperSet<Assignment> {
  public constructor(readonly table: Table) {
    super();
  }

  public addAssignment(column: Column | ColumnReference, value: ColumnValue): this {
    return this.add(`${column.getEscapedName()} = ${escape(value)}`);
  }

  @Memoize()
  public get sql(): string | null {
    return this.size > 0 ? [...this].join(', ') : null;
  }
}
