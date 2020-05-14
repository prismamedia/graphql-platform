import { SuperSet } from '@prismamedia/graphql-platform-utils';
import { Column } from '../column';
import { ColumnReference } from '../column-reference';

export class ColumnSet<
  T extends Column | ColumnReference = Column | ColumnReference
> extends SuperSet<T> {
  public getEscapedNames(alias?: string): string {
    return [...this].map((column) => column.getEscapedName(alias)).join(', ');
  }
}
