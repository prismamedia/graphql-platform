import { UnexpectedValueError } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
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
    public readonly operator:
      | 'contains'
      | 'not_contains'
      | 'starts_with'
      | 'not_starts_with'
      | 'ends_with'
      | 'not_ends_with',
    public readonly value: string,
  ) {
    if (typeof value !== 'string' || !value) {
      throw new UnexpectedValueError(value, `a non-empty string`);
    }

    this.reduced = this;
  }

  @Memoize()
  public get complement(): LeafFullTextFilter {
    return new LeafFullTextFilter(
      this.leaf,
      this.operator === 'contains'
        ? 'not_contains'
        : this.operator === 'not_contains'
        ? 'contains'
        : this.operator === 'starts_with'
        ? 'not_starts_with'
        : this.operator === 'not_starts_with'
        ? 'starts_with'
        : this.operator === 'ends_with'
        ? 'not_ends_with'
        : 'ends_with',
      this.value,
    );
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
