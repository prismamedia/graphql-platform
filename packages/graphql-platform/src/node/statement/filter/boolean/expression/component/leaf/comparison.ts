import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { NodeSelectedValue } from '../../../../../../../node.js';
import type {
  Component,
  Leaf,
  LeafValue,
} from '../../../../../../definition/component.js';
import { DependencyGraph } from '../../../../../../subscription.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
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
  public readonly key: string;

  public readonly component: Component;
  public readonly score: number;
  public readonly dependencies: DependencyGraph;
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

    this.key = operator === 'eq' ? leaf.name : `${leaf.name}_${operator}`;

    this.component = leaf;
    this.score = 2;
    this.dependencies = DependencyGraph.fromLeaf(this);

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
    | [LeafComparisonFilter, LeafComparisonFilter]
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

        // Distributive law: A . (B + C) = (A . B) + (A . C)
        if (remainingReducers) {
          return OrOperation.create(
            operand.operands.map((operand) =>
              AndOperation.create([operand, this], remainingReducers),
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

      // Associative law: A + (B + C) = (A + B) + C = (A + C) + B
      if (remainingReducers && operand.operands) {
        const [a, b] = operand.operands;

        return [
          OrOperation.create(
            [a, OrOperation.create([this, b], remainingReducers)],
            remainingReducers,
          ),
          OrOperation.create(
            [b, OrOperation.create([this, a], remainingReducers)],
            remainingReducers,
          ),
        ].sort(({ score: a }, { score: b }) => a - b)[0];
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

  public execute(value: NodeSelectedValue): boolean | undefined {
    const leafValue = value[this.leaf.name];
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

  public get ast(): LeafComparisonFilterAST {
    return {
      kind: 'LEAF',
      leaf: this.leaf.name,
      operator: this.operator.toUpperCase() as any,
      value: this.value,
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return { [this.key]: this.value };
  }
}
