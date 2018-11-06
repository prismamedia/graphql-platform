import { AnyRelation } from '@prismamedia/graphql-platform-core';
import { SuperSet } from '@prismamedia/graphql-platform-utils';
import { Memoize } from 'typescript-memoize';
import { Column, ColumnReference, ColumnSet } from '../../../table';
import { TableReference } from '../reference';

export type SelectExpression = string | Column | ColumnReference | ColumnSet | SelectExpressionSet;

export class SelectExpressionSet extends SuperSet<SelectExpression> {
  public constructor(readonly tableReference: TableReference) {
    super();
  }

  public on(relation: AnyRelation, callback: (select: SelectExpressionSet) => void, key?: string): this {
    const joinTable = this.tableReference.join(relation, key);
    const select = new SelectExpressionSet(joinTable);
    callback(select);
    this.add(select);

    return this;
  }

  public get expressions(): SuperSet<string> {
    const expressionSet = new SuperSet<string>();

    for (const expression of this) {
      if (typeof expression === 'string') {
        expression && expressionSet.add(expression);
      } else if (expression instanceof Column || expression instanceof ColumnReference) {
        expressionSet.add(expression.getEscapedName(this.tableReference.alias));
      } else if (expression instanceof ColumnSet) {
        [...expression].forEach(column => expressionSet.add(column.getEscapedName(this.tableReference.alias)));
      } else if (expression instanceof SelectExpressionSet) {
        expressionSet.push(...expression.expressions);
      }
    }

    return expressionSet;
  }

  @Memoize()
  public get sql(): string {
    return [...this.expressions].join(', ');
  }
}
