import { SuperSet } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { Column, ColumnReference } from '../..';
import { TableReference } from './reference';

export type OrderByExpression = string;

export class OrderByExpressionSet extends SuperSet<OrderByExpression> {
  public constructor(readonly tableReference: TableReference) {
    super();
  }

  public addSort(column: Column | ColumnReference, direction: 'ASC' | 'DESC' = 'ASC'): this {
    return this.add([column.getEscapedName(this.tableReference.alias), direction].join(' '));
  }

  public get expressions(): SuperSet<string> {
    const expressionSet = new SuperSet<string>();

    for (const expression of this) {
      if (typeof expression === 'string') {
        expression && expressionSet.add(expression);
      }
    }

    return expressionSet;
  }

  @Memoize()
  public get sql(): string | null {
    return this.expressions.size > 0 ? [...this.expressions].join(', ') : null;
  }
}
