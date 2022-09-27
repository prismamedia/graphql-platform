import * as utils from '@prismamedia/graphql-platform-utils';
import type { Leaf } from '../../../../../../definition/component/leaf.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';

export interface LeafFullTextFilterAST {
  kind: 'LeafFilter';
  leaf: Leaf['name'];
  operator: LeafFullTextFilter['operator'];
  value: LeafFullTextFilter['value'];
}

export class LeafFullTextFilter implements BooleanExpressionInterface {
  public readonly reduced: this;

  public constructor(
    public readonly leaf: Leaf,
    public readonly operator: 'contains' | 'starts_with' | 'ends_with',
    public readonly value: string,
  ) {
    if (typeof value !== 'string' || !value) {
      throw new utils.UnexpectedValueError(value, `a non-empty string`);
    }

    this.reduced = this;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafFullTextFilter &&
      expression.leaf === this.leaf &&
      expression.operator === this.operator &&
      expression.value === this.value
    );
  }

  public and(_expression: unknown) {
    return undefined;
  }

  public or(_expression: unknown) {
    return undefined;
  }

  public get ast(): LeafFullTextFilterAST {
    return {
      kind: 'LeafFilter',
      leaf: this.leaf.name,
      operator: this.operator,
      value: this.value,
    };
  }
}
