import _ from 'lodash';
import assert from 'node:assert/strict';
import type {
  Leaf,
  LeafValue,
} from '../../../../../../definition/component/leaf.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import { BooleanValue } from '../../../value.js';
import { LeafComparisonFilter } from './comparison.js';

export interface LeafInFilterAST {
  kind: 'LeafFilter';
  leaf: Leaf['name'];
  operator: 'in';
  values: LeafInFilter['values'];
}

export class LeafInFilter implements BooleanExpressionInterface {
  /**
   * It is not a "Set" because we want to control the "equality comparison algorithm"
   */
  public readonly values: ReadonlyArray<LeafValue>;
  public readonly reduced: BooleanValue<false> | LeafComparisonFilter | this;

  public constructor(
    public readonly leaf: Leaf,
    values: ReadonlyArray<LeafValue>,
  ) {
    assert(!values.includes(undefined as any));

    this.values = _.uniqWith(
      leaf.isNullable() ? values : values.filter((value) => value !== null),
      leaf.areValuesEqual.bind(leaf),
    );

    this.reduced =
      this.values.length === 0
        ? new BooleanValue(false)
        : this.values.length === 1
        ? new LeafComparisonFilter(this.leaf, 'eq', this.values[0])
        : this;
  }

  protected has(value: LeafValue): boolean {
    // We do not use "Array.includes" here because we want to control the "equality comparison algorithm"
    return this.values.some((currentValue) =>
      this.leaf.areValuesEqual(currentValue, value),
    );
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafInFilter &&
      expression.leaf === this.leaf &&
      expression.values.length === this.values.length &&
      expression.values.every((value) => this.has(value))
    );
  }

  public and(expression: unknown): BooleanFilter | undefined {
    if (expression instanceof LeafInFilter && expression.leaf === this.leaf) {
      return new LeafInFilter(
        this.leaf,
        _.intersectionWith(
          this.values,
          expression.values,
          this.leaf.areValuesEqual.bind(this.leaf),
        ),
      );
    } else if (
      expression instanceof LeafComparisonFilter &&
      expression.leaf === this.leaf
    ) {
      if (expression.operator === 'eq') {
        return this.has(expression.value)
          ? expression
          : new BooleanValue(false);
      }
    }
  }

  public or(expression: unknown): BooleanFilter | undefined {
    if (expression instanceof LeafInFilter && expression.leaf === this.leaf) {
      return new LeafInFilter(this.leaf, [
        ...this.values,
        ...expression.values,
      ]);
    } else if (
      expression instanceof LeafComparisonFilter &&
      expression.leaf === this.leaf
    ) {
      if (expression.operator === 'eq') {
        return new LeafInFilter(this.leaf, [...this.values, expression.value]);
      }
    }
  }

  public get ast(): LeafInFilterAST {
    return {
      kind: 'LeafFilter',
      leaf: this.leaf.name,
      operator: 'in',
      values: this.values,
    };
  }
}
