import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { NodeValue } from '../../../../../../../node.js';
import type {
  Leaf,
  LeafValue,
} from '../../../../../../definition/component/leaf.js';
import type { DependencyTree } from '../../../../../../result-set.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import {
  AndOperation,
  OrOperation,
  type AndOperand,
  type OrOperand,
} from '../../../operation.js';
import { FalseValue, TrueValue } from '../../../value.js';
import { LeafInFilter } from './in.js';

export interface LeafComparisonFilterAST {
  kind: 'LEAF';
  leaf: Leaf['name'];
  operator: Uppercase<LeafComparisonFilter['operator']>;
  value: LeafComparisonFilter['value'];
}

export const sortableLeafComparisonOperatorSet = new Set([
  'gt',
  'gte',
  'lt',
  'lte',
] satisfies LeafComparisonFilter['operator'][]);

export class LeafComparisonFilter implements BooleanExpressionInterface {
  public readonly score: number;
  public readonly dependencies: DependencyTree;
  readonly #complement?: LeafComparisonFilter;

  public constructor(
    public readonly leaf: Leaf,
    public readonly operator: 'eq' | 'not' | 'gt' | 'gte' | 'lt' | 'lte',
    public readonly value: LeafValue,
    complement?: LeafComparisonFilter,
  ) {
    assert.notEqual(value, undefined);
    leaf.isNullable() || assert.notEqual(value, null);

    if (sortableLeafComparisonOperatorSet.has(operator as any)) {
      assert.notEqual(value, null);
      assert(leaf.isSortable(), `The "${leaf}" leaf is not sortable`);
    }

    this.score = 2;
    this.dependencies = new Map([[leaf, undefined]]);
    this.#complement = complement;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof LeafComparisonFilter &&
      expression.leaf === this.leaf &&
      expression.operator === this.operator &&
      expression.leaf.areValuesEqual(expression.value, this.value)
    );
  }

  @Memoize()
  public get operands():
    | ReadonlyArray<Extract<OrOperand, LeafComparisonFilter>>
    | undefined {
    return ['gte', 'lte'].includes(this.operator)
      ? [
          new LeafComparisonFilter(
            this.leaf,
            this.operator === 'gte' ? 'gt' : 'lt',
            this.value,
          ),
          new LeafComparisonFilter(this.leaf, 'eq', this.value),
        ]
      : undefined;
  }

  @Memoize()
  public get complement(): LeafComparisonFilter {
    return (
      this.#complement ??
      (this.operator === 'eq'
        ? new LeafComparisonFilter(this.leaf, 'not', this.value, this)
        : this.operator === 'not'
        ? new LeafComparisonFilter(this.leaf, 'eq', this.value, this)
        : this.operator === 'gt'
        ? new LeafComparisonFilter(this.leaf, 'lte', this.value, this)
        : this.operator === 'gte'
        ? new LeafComparisonFilter(this.leaf, 'lt', this.value, this)
        : this.operator === 'lt'
        ? new LeafComparisonFilter(this.leaf, 'gte', this.value, this)
        : new LeafComparisonFilter(this.leaf, 'gt', this.value, this))
    );
  }

  public and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (operand instanceof LeafComparisonFilter && operand.leaf === this.leaf) {
      if (this.operator === 'eq' && operand.operator === 'eq') {
        return this.leaf.areValuesEqual(this.value, operand.value)
          ? this
          : FalseValue;
      } else if (this.operator === 'eq' && operand.operator === 'not') {
        return this.leaf.areValuesEqual(this.value, operand.value)
          ? FalseValue
          : this;
      }

      if (
        sortableLeafComparisonOperatorSet.has(this.operator as any) ||
        sortableLeafComparisonOperatorSet.has(operand.operator as any)
      ) {
        if (this.value === null || operand.value === null) {
          return FalseValue;
        }

        if (this.operator === 'eq') {
          if (operand.operator === 'gt') {
            return this.value > operand.value ? this : FalseValue;
          } else if (operand.operator === 'lt') {
            return this.value < operand.value ? this : FalseValue;
          }
        }

        if (this.operator === 'gt' && operand.operator === 'gt') {
          return this.value >= operand.value ? this : operand;
        } else if (this.operator === 'lt' && operand.operator === 'lt') {
          return this.value <= operand.value ? this : operand;
        }

        if (this.operator === 'gt' && operand.operator === 'lt') {
          return this.value >= operand.value ? FalseValue : undefined;
        }
      }

      if (operand.operands) {
        // Absorption law: A . (A + B) = A
        if (operand.operands.some((operand) => operand.equals(this))) {
          return this;
        }

        // Distributive law: (A + B) . (C + D) = (A . C) + (A . D) + (B . C) + (B . D)
        if (remainingReducers) {
          return OrOperation.create(
            operand.operands.flatMap((a) =>
              (this.operands ?? [this]).map((b) =>
                AndOperation.create([a, b], remainingReducers),
              ),
            ),
            remainingReducers,
          );
        }
      }
    }
  }

  public or(
    operand: OrOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (operand instanceof LeafComparisonFilter && operand.leaf === this.leaf) {
      if (this.operator === 'eq' && operand.operator === 'eq') {
        return LeafInFilter.create(this.leaf, [this.value, operand.value]);
      } else if (this.operator === 'eq' && operand.operator === 'not') {
        return this.leaf.areValuesEqual(this.value, operand.value)
          ? TrueValue
          : operand;
      }

      if (this.value === null || operand.value === null) {
        return undefined;
      }

      // Associative law: (A + B) + (C + D) = A + B + C + D
      if (remainingReducers && operand.operands) {
        return OrOperation.create(
          R.uniqWith(
            [...(this.operands || [this]), ...operand.operands],
            (a, b) => a.equals(b),
          ),
          remainingReducers,
        );
      }

      if (this.operator === 'eq') {
        if (operand.operator === 'gt') {
          return this.leaf.areValuesEqual(this.value, operand.value)
            ? new LeafComparisonFilter(this.leaf, 'gte', this.value)
            : this.value > operand.value
            ? operand
            : undefined;
        } else if (operand.operator === 'lt') {
          return this.leaf.areValuesEqual(this.value, operand.value)
            ? new LeafComparisonFilter(this.leaf, 'lte', this.value)
            : this.value < operand.value
            ? operand
            : undefined;
        }
      }

      if (this.operator === 'gt' && operand.operator === 'gt') {
        return this.value <= operand.value ? this : operand;
      } else if (this.operator === 'lt' && operand.operator === 'lt') {
        return this.value >= operand.value ? this : operand;
      }

      if (this.operator === 'gt' && operand.operator === 'lt') {
        return this.leaf.areValuesEqual(this.value, operand.value)
          ? new LeafComparisonFilter(this.leaf, 'not', this.value)
          : this.value < operand.value
          ? TrueValue
          : undefined;
      }
    }
  }

  public get ast(): LeafComparisonFilterAST {
    return {
      kind: 'LEAF',
      leaf: this.leaf.name,
      operator: this.operator.toUpperCase() as any,
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
    } else if (this.operator === 'not') {
      return !this.leaf.areValuesEqual(leafValue, this.value);
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

      default:
        throw new utils.UnreachableValueError(this.operator);
    }
  }
}
