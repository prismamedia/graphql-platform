import * as graphql from 'graphql';
import assert from 'node:assert';
import { type NodeSelectedValue } from '../../../../../../../node.js';
import type { MultipleReverseEdge } from '../../../../../../definition.js';
import type { RawDependency } from '../../../../../../dependency.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { BooleanFilter } from '../../../../boolean.js';
import {
  AndOperation,
  OrOperation,
  type AndOperand,
  type OrOperand,
} from '../../../operation.js';
import { FalseValue, TrueValue } from '../../../value.js';
import { AbstractReverseEdgeFilter } from '../../abstract-reverse-edge.js';

export class MultipleReverseEdgeExistsFilter extends AbstractReverseEdgeFilter {
  public static create(
    reverseEdge: MultipleReverseEdge,
    headFilter?: NodeFilter,
  ): BooleanFilter {
    if (headFilter) {
      assert.strictEqual(reverseEdge.head, headFilter.node);

      if (!headFilter.normalized) {
        return MultipleReverseEdgeExistsFilter.create(reverseEdge);
      } else if (headFilter.isFalse()) {
        return FalseValue;
      }
    }

    return new this(reverseEdge, headFilter);
  }

  public readonly key: string;
  public readonly score: number;

  public constructor(
    public override readonly reverseEdge: MultipleReverseEdge,
    public readonly headFilter?: NodeFilter,
  ) {
    super(reverseEdge);

    this.key = `${reverseEdge.name}_some`;
    this.score = 1 + (headFilter?.score ?? 0);
  }

  public equals(
    expression: unknown,
  ): expression is MultipleReverseEdgeExistsFilter {
    return (
      expression instanceof MultipleReverseEdgeExistsFilter &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  public override and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof MultipleReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return MultipleReverseEdgeExistsFilter.create(
        this.reverseEdge,
        this.headFilter && operand.headFilter
          ? new NodeFilter(
              this.reverseEdge.head,
              AndOperation.create(
                [this.headFilter.filter, operand.headFilter.filter],
                remainingReducers,
              ),
            )
          : this.headFilter || operand.headFilter,
      );
    }

    return;
  }

  public override or(
    operand: OrOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof MultipleReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return MultipleReverseEdgeExistsFilter.create(
        this.reverseEdge,
        this.headFilter && operand.headFilter
          ? new NodeFilter(
              this.reverseEdge.head,
              OrOperation.create(
                [this.headFilter.filter, operand.headFilter.filter],
                remainingReducers,
              ),
            )
          : undefined,
      );
    }

    return;
  }

  public override execute(value: NodeSelectedValue): boolean | undefined {
    const reverseEdgeHeadValues = value[this.reverseEdge.name];

    if (reverseEdgeHeadValues === undefined) {
      return;
    } else if (
      !Array.isArray(reverseEdgeHeadValues) ||
      !reverseEdgeHeadValues.length
    ) {
      return false;
    }

    return this.headFilter
      ? reverseEdgeHeadValues.some((reverseEdgeHeadValue) =>
          this.headFilter!.execute(reverseEdgeHeadValue, true),
        )
      : true;
  }

  public override get dependencies(): RawDependency[] {
    return [
      {
        kind: 'ReverseEdge',
        reverseEdge: this.reverseEdge,
        head: {
          filter: this.headFilter,
        },
      },
    ];
  }

  public get ast(): graphql.ConstObjectValueNode {
    return {
      kind: graphql.Kind.OBJECT,
      fields: [
        {
          kind: graphql.Kind.OBJECT_FIELD,
          name: { kind: graphql.Kind.NAME, value: this.key },
          value: (this.headFilter ?? TrueValue).ast,
        },
      ],
    };
  }

  public get inputValue(): NonNullable<NodeFilterInputValue> {
    return { [this.key]: (this.headFilter ?? TrueValue).inputValue };
  }
}
