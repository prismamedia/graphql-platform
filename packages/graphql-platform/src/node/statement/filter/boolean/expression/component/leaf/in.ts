import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { NodeValue } from '../../../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../../../change.js';
import type {
  Component,
  Leaf,
  LeafValue,
} from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import type { NodeSelectedValue } from '../../../../../selection.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import type { AndOperand } from '../../../operation/and.js';
import { OrOperation, type OrOperand } from '../../../operation/or.js';
import { FalseValue, TrueValue } from '../../../value.js';
import {
  LeafComparisonFilter,
  sortableLeafComparisonOperatorSet,
} from './comparison.js';

export interface LeafInFilterAST {
  kind: 'LEAF';
  leaf: Leaf['name'];
  operator: 'IN';
  values: LeafInFilter['values'];
}

export class LeafInFilter implements BooleanExpressionInterface {
  public static create(
    leaf: Leaf,
    rawValues: ReadonlyArray<LeafValue>,
  ): BooleanFilter {
    assert(!rawValues.includes(undefined as any));
    leaf.isNullable() || assert(!rawValues.includes(null as any));

    const values = leaf.uniqValues(rawValues);

    return values.length === 0
      ? FalseValue
      : values.length === 1
      ? new LeafComparisonFilter(leaf, 'eq', values[0])
      : new this(leaf, values);
  }

  public readonly key: string;

  public readonly component: Component;
  public readonly score: number;
  public readonly complement: undefined;

  protected constructor(
    public readonly leaf: Leaf,
    public readonly values: ReadonlyArray<LeafValue>,
  ) {
    this.key = `${leaf.name}_in`;

    this.component = leaf;
    this.score = 1 + values.length;
  }

  public has(value: LeafValue): boolean {
    // We do not use "Array.includes" here because we want to control the "equality comparison algorithm"
    return this.values.some((currentValue) =>
      this.leaf.areValuesEqual(currentValue, value),
    );
  }

  public equals(expression: unknown): expression is LeafInFilter {
    return (
      expression instanceof LeafInFilter &&
      expression.leaf === this.leaf &&
      expression.values.length === this.values.length &&
      expression.values.every((value) => this.has(value))
    );
  }

  @Memoize()
  public get operands(): ReadonlyArray<LeafComparisonFilter> {
    return this.values.map(
      (value) => new LeafComparisonFilter(this.leaf, 'eq', value),
    );
  }

  public and(
    operand: AndOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    if (operand instanceof LeafInFilter && operand.leaf === this.leaf) {
      const values = R.intersectionWith(
        this.values,
        operand.values,
        this.leaf.areValuesEqual.bind(this.leaf),
      );

      return values.length === this.values.length
        ? this
        : values.length === operand.values.length
        ? operand
        : LeafInFilter.create(this.leaf, values);
    } else if (
      operand instanceof LeafComparisonFilter &&
      operand.leaf === this.leaf
    ) {
      if (operand.operator === 'eq') {
        return this.has(operand.value) ? operand : FalseValue;
      } else if (operand.operator === 'not') {
        const values = this.values.filter(
          (value) => !this.leaf.areValuesEqual(value, operand.value),
        );

        return values.length === this.values.length
          ? this
          : LeafInFilter.create(this.leaf, values);
      }

      if (sortableLeafComparisonOperatorSet.has(operand.operator as any)) {
        const values =
          operand.operator === 'gt'
            ? this.values.filter(
                (value) => value !== null && value > operand.value!,
              )
            : operand.operator === 'gte'
            ? this.values.filter(
                (value) => value !== null && value >= operand.value!,
              )
            : operand.operator === 'lt'
            ? this.values.filter(
                (value) => value !== null && value < operand.value!,
              )
            : this.values.filter(
                (value) => value !== null && value <= operand.value!,
              );

        return values.length === this.values.length
          ? this
          : LeafInFilter.create(this.leaf, values);
      }
    }
  }

  public or(
    operand: OrOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    if (operand instanceof LeafInFilter && operand.leaf === this.leaf) {
      const values = this.leaf.uniqValues([...this.values, ...operand.values]);

      return values.length === this.values.length
        ? this
        : new LeafInFilter(this.leaf, values);
    } else if (
      operand instanceof LeafComparisonFilter &&
      operand.leaf === this.leaf
    ) {
      if (operand.operator === 'eq') {
        return this.has(operand.value)
          ? this
          : new LeafInFilter(this.leaf, [...this.values, operand.value]);
      } else if (operand.operator === 'not') {
        return this.has(operand.value) ? TrueValue : operand;
      }

      if (sortableLeafComparisonOperatorSet.has(operand.operator as any)) {
        const values =
          operand.operator === 'gt'
            ? this.values.filter(
                (value) => value === null || value <= operand.value!,
              )
            : operand.operator === 'gte'
            ? this.values.filter(
                (value) => value === null || value < operand.value!,
              )
            : operand.operator === 'lt'
            ? this.values.filter(
                (value) => value === null || value >= operand.value!,
              )
            : this.values.filter(
                (value) => value === null || value > operand.value!,
              );

        return values.length === this.values.length
          ? undefined
          : OrOperation.create(
              [LeafInFilter.create(this.leaf, values), operand],
              0,
            );
      }
    }
  }

  public execute(value: NodeSelectedValue): boolean | undefined {
    const leafValue = value[this.leaf.name];
    if (leafValue === undefined) {
      return;
    }

    return this.has(leafValue);
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return (
      update.hasComponentUpdate(this.leaf) &&
      this.execute(update.oldValue) !== this.execute(update.newValue)
    );
  }

  public getAffectedGraphByNodeChange(
    _change: NodeChange,
    _visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    return FalseValue;
  }

  public get ast(): LeafInFilterAST {
    return {
      kind: 'LEAF',
      leaf: this.leaf.name,
      operator: 'IN',
      values: this.values,
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return { [this.key]: this.values };
  }
}
