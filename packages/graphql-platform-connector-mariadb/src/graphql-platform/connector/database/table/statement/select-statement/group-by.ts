import { SuperSet } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { Column, ColumnReference, ColumnSet } from '../../../table';
import { TableReference } from '../reference';

// cf: https://dev.mysql.com/doc/refman/8.0/en/group-by-modifiers.html
export type GroupByExpression = string | Column | ColumnReference | ColumnSet;

export class GroupByExpressionSet extends SuperSet<GroupByExpression> {
  public constructor(readonly tableReference: TableReference) {
    super();
  }

  public get expressions(): SuperSet<string> {
    const expressionSet = new SuperSet<string>();

    for (const expression of this) {
      if (typeof expression === 'string') {
        expression && expressionSet.add(expression);
      } else if (
        expression instanceof Column ||
        expression instanceof ColumnReference
      ) {
        expressionSet.add(expression.getEscapedName(this.tableReference.alias));
      } else if (expression instanceof ColumnSet) {
        [...expression].forEach((column) =>
          expressionSet.add(column.getEscapedName(this.tableReference.alias)),
        );
      }
    }

    return expressionSet;
  }

  @Memoize()
  public get sql(): string | null {
    return this.expressions.size > 0 ? [...this.expressions].join(', ') : null;
  }
}
