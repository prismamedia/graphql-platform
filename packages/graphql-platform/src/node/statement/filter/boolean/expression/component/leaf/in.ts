import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import * as R from 'remeda';
import type {
  Leaf,
  LeafValue,
  UniqueConstraint,
} from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import type { NodeSelectedValue } from '../../../../../selection.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { AndOperand } from '../../../operation/and.js';
import { OrOperation, type OrOperand } from '../../../operation/or.js';
import { FalseValue, TrueValue } from '../../../value.js';
import { AbstractLeafFilter } from '../abstract-leaf.js';
import {
  LeafComparisonFilter,
  sortableLeafComparisonOperatorSet,
} from './comparison.js';

export class LeafInFilter extends AbstractLeafFilter {
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
  public readonly score: number;

  protected constructor(
    leaf: Leaf,
    public readonly values: ReadonlyArray<LeafValue>,
  ) {
    super(leaf);

    this.key = `${leaf.name}_in`;
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

  public override and(
    operand: AndOperand,
    _remainingReducers: number,
  ): BooleanFilter | undefined {
    if (operand instanceof LeafInFilter && operand.leaf === this.leaf) {
      const intersection = R.intersectionWith(
        this.values,
        operand.values,
        (a, b) => this.leaf.areValuesEqual(a, b),
      );

      return intersection.length === this.values.length
        ? this
        : intersection.length === operand.values.length
          ? operand
          : LeafInFilter.create(this.leaf, intersection);
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

  public override or(
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

  public override execute(value: NodeSelectedValue): boolean | undefined {
    const leafValue = value[this.leaf.name];
    if (leafValue === undefined) {
      return;
    }

    return this.has(leafValue);
  }

  public override isExecutableWithinUniqueConstraint(
    unique: UniqueConstraint,
  ): boolean {
    return unique.leafSet.has(this.leaf);
  }

  public get ast(): graphql.ConstObjectValueNode {
    return {
      kind: graphql.Kind.OBJECT,
      fields: [
        {
          kind: graphql.Kind.OBJECT_FIELD,
          name: {
            kind: graphql.Kind.NAME,
            value: this.key,
          },
          value: {
            kind: graphql.Kind.LIST,
            values: this.values.map(
              (value) => graphql.astFromValue(value, this.leaf.type) as any,
            ),
          },
        },
      ],
    };
  }

  public get inputValue(): NonNullable<NodeFilterInputValue> {
    return { [this.key]: this.values };
  }
}
