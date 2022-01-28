import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'node:assert/strict';
import type {
  Leaf,
  LeafValue,
} from '../../../../../../definition/component/leaf.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import { NotOperation } from '../../../operation/not.js';
import { BooleanValue } from '../../../value.js';
import { LeafInFilter } from './in.js';

export interface LeafComparisonFilterAST {
  kind: 'LeafFilter';
  leaf: Leaf['name'];
  operator: LeafComparisonFilter['operator'];
  value: LeafComparisonFilter['value'];
}

export class LeafComparisonFilter implements BooleanExpressionInterface {
  public readonly reduced: BooleanValue | this;

  public constructor(
    public readonly leaf: Leaf,
    public readonly operator: 'eq' | 'not' | 'gt' | 'gte' | 'lt' | 'lte',
    public readonly value: LeafValue,
  ) {
    assert.notEqual(value, undefined);

    if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
      assert(leaf.sortable, `The "${leaf}" leaf is not sortable`);
      assert.notEqual(value, null);
    }

    this.reduced =
      !leaf.isNullable() && value === null
        ? operator === 'eq'
          ? new BooleanValue(false)
          : operator === 'not'
          ? new BooleanValue(true)
          : this
        : this;
  }

  @Memoize()
  public get complement(): LeafComparisonFilter {
    return new LeafComparisonFilter(
      this.leaf,
      this.operator === 'eq'
        ? 'not'
        : this.operator === 'not'
        ? 'eq'
        : this.operator === 'gt'
        ? 'lte'
        : this.operator === 'gte'
        ? 'lt'
        : this.operator === 'lt'
        ? 'gte'
        : 'gt',
      this.value,
    );
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafComparisonFilter &&
      expression.leaf === this.leaf &&
      expression.operator === this.operator &&
      expression.leaf.areValuesEqual(expression.value, this.value)
    );
  }

  public and(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof LeafComparisonFilter &&
      expression.leaf === this.leaf
    ) {
      if (this.operator === 'eq') {
        if (expression.operator === 'eq') {
          if (!this.leaf.areValuesEqual(this.value, expression.value)) {
            return new BooleanValue(false);
          }
        } else if (expression.operator === 'not') {
          if (this.leaf.areValuesEqual(this.value, expression.value)) {
            return new BooleanValue(false);
          }
        } else if (this.value !== null && expression.value !== null) {
          if (expression.operator === 'gt') {
            return this.value <= expression.value
              ? new BooleanValue(false)
              : this;
          } else if (expression.operator === 'gte') {
            return this.value < expression.value
              ? new BooleanValue(false)
              : this;
          } else if (expression.operator === 'lt') {
            return this.value >= expression.value
              ? new BooleanValue(false)
              : this;
          } else if (expression.operator === 'lte') {
            return this.value > expression.value
              ? new BooleanValue(false)
              : this;
          }
        }
      } else if (this.operator === 'not') {
        if (expression.operator === 'not') {
          if (!this.leaf.areValuesEqual(this.value, expression.value)) {
            // De Morgan's laws: (NOT A) AND (NOT B) = NOT (A OR B)
            return new NotOperation(
              new LeafInFilter(this.leaf, [this.value, expression.value]),
            );
          }
        }
      } else if (this.value !== null && expression.value !== null) {
        if (
          (this.operator === 'gt' && expression.operator === 'gt') ||
          (this.operator === 'gte' && expression.operator === 'gte')
        ) {
          return this.value >= expression.value ? this : expression;
        } else if (
          (this.operator === 'lt' && expression.operator === 'lt') ||
          (this.operator === 'lte' && expression.operator === 'lte')
        ) {
          return this.value <= expression.value ? this : expression;
        }
      }
    }
  }

  public or(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof LeafComparisonFilter &&
      expression.leaf === this.leaf
    ) {
      if (this.operator === 'eq') {
        if (expression.operator === 'eq') {
          return new LeafInFilter(this.leaf, [this.value, expression.value]);
        } else if (expression.operator === 'not') {
          if (this.leaf.areValuesEqual(this.value, expression.value)) {
            return new BooleanValue(true);
          }
        }
      }
    }
  }

  public get ast(): LeafComparisonFilterAST {
    return {
      kind: 'LeafFilter',
      leaf: this.leaf.name,
      operator: this.operator,
      value: this.value,
    };
  }
}
