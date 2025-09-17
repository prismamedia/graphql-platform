import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { NodeSelectedValue } from '../../../../../../../node.js';
import type { UniqueReverseEdge } from '../../../../../../definition.js';
import type { RawDependency } from '../../../../../../dependency.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { AndOperand, OrOperand } from '../../../operation.js';
import { AndOperation, NotOperation, OrOperation } from '../../../operation.js';
import { FalseValue, TrueValue } from '../../../value.js';
import { AbstractReverseEdgeFilter } from '../../abstract-reverse-edge.js';

export class UniqueReverseEdgeExistsFilter extends AbstractReverseEdgeFilter {
  public static create(
    reverseEdge: UniqueReverseEdge,
    headFilter?: NodeFilter,
  ): BooleanFilter {
    if (headFilter) {
      assert.strictEqual(reverseEdge.head, headFilter.node);

      if (!headFilter.normalized) {
        return UniqueReverseEdgeExistsFilter.create(reverseEdge);
      } else if (headFilter.isFalse()) {
        return FalseValue;
      }
    }

    return new this(reverseEdge, headFilter);
  }

  public readonly key: string;
  public readonly score: number;

  protected constructor(
    public override readonly reverseEdge: UniqueReverseEdge,
    public readonly headFilter?: NodeFilter,
  ) {
    super(reverseEdge);

    this.key = reverseEdge.name;
    this.score = 1 + (headFilter?.score ?? 0);
  }

  public equals(
    expression: unknown,
  ): expression is UniqueReverseEdgeExistsFilter {
    return (
      expression instanceof UniqueReverseEdgeExistsFilter &&
      expression.reverseEdge === this.reverseEdge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  @MGetter
  public override get complement(): BooleanFilter | undefined {
    return this.headFilter
      ? new OrOperation([
          new NotOperation(new UniqueReverseEdgeExistsFilter(this.reverseEdge)),
          new UniqueReverseEdgeExistsFilter(
            this.reverseEdge,
            this.headFilter.complement,
          ),
        ])
      : undefined;
  }

  public override and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof UniqueReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return UniqueReverseEdgeExistsFilter.create(
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
  }

  public override or(
    operand: OrOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof UniqueReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return UniqueReverseEdgeExistsFilter.create(
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
  }

  public override execute(value: NodeSelectedValue): boolean | undefined {
    const reverseEdgeHeadValue = value[this.reverseEdge.name];

    if (reverseEdgeHeadValue === undefined) {
      return;
    } else if (reverseEdgeHeadValue === null) {
      return false;
    }

    return this.headFilter
      ? this.headFilter.execute(reverseEdgeHeadValue, true)
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
