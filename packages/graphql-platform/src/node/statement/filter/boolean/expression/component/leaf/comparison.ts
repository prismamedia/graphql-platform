import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../../node.js';
import type {
  Leaf,
  LeafValue,
} from '../../../../../../definition/component/leaf.js';
import type { DependencyTree } from '../../../../../../result-set.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
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
    public readonly operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte',
    public readonly value: LeafValue,
  ) {
    assert.notEqual(value, undefined);

    if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
      assert(leaf.isSortable(), `The "${leaf}" leaf is not sortable`);
      assert.notEqual(value, null);
    }

    this.reduced =
      !leaf.isNullable() && operator === 'eq' && value === null
        ? new BooleanValue(false)
        : this;
  }

  public get dependencies(): DependencyTree | undefined {
    return new Map([[this.leaf, undefined]]);
  }

  @Memoize()
  public get complement(): LeafComparisonFilter | undefined {
    return this.operator === 'eq'
      ? undefined
      : new LeafComparisonFilter(
          this.leaf,
          this.operator === 'gt'
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

  public execute(nodeValue: Partial<NodeValue>): boolean | undefined {
    const leafValue = nodeValue[this.leaf.name];
    if (leafValue === undefined) {
      return;
    }

    if (this.operator === 'eq') {
      return this.leaf.areValuesEqual(leafValue, this.value);
    }

    if (leafValue === null || this.value === null) {
      return false;
    }

    switch (this.operator) {
      case 'gt':
        return leafValue > this.value;

      case 'gte':
        return leafValue >= this.value;

      case 'lt':
        return leafValue < this.value;

      case 'lte':
        return leafValue <= this.value;
    }
  }
}
