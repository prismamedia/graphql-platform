import { FieldValue } from '@prismamedia/graphql-platform-core';
import { SuperSet } from '@prismamedia/graphql-platform-utils';
import { escape } from 'mysql';
import { Memoize } from 'typescript-memoize';
import { Column, ColumnReference } from '../../../table';
import { TableReference } from '../reference';

export type Assignment = string;

export class AssignmentSet extends SuperSet<Assignment> {
  public constructor(readonly tableReference: TableReference) {
    super();
  }

  public addAssignment(column: Column | ColumnReference, value: FieldValue): this {
    return this.add(`${column.getEscapedName(this.tableReference.alias)} = ${escape(value)}`);
  }

  @Memoize()
  public get sql(): string {
    if (this.size === 0) {
      throw new Error(`At least one assignment has to be defined.`);
    }

    return [...this].join(', ');
  }
}
