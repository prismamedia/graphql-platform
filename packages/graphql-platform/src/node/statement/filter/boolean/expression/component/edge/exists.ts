import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import { EdgeDependencyGraph } from '../../../../../../change/dependency.js';
import type { Edge, UniqueConstraint } from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { NodeSelectedValue } from '../../../../../selection.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { AndOperand, OrOperand } from '../../../operation.js';
import { AndOperation, NotOperation, OrOperation } from '../../../operation.js';
import { FalseValue, TrueValue } from '../../../value.js';
import { AbstractComponentFilter } from '../../abstract-component.js';

export class EdgeExistsFilter extends AbstractComponentFilter {
  public static create(edge: Edge, headFilter?: NodeFilter): BooleanFilter {
    if (headFilter) {
      assert.equal(edge.head, headFilter.node);

      if (!headFilter.normalized) {
        return EdgeExistsFilter.create(edge);
      } else if (headFilter.isFalse()) {
        return FalseValue;
      }
    } else if (!edge.isNullable()) {
      return TrueValue;
    }

    return new this(edge, headFilter);
  }

  public readonly key: string;
  public readonly score: number;

  protected constructor(
    public readonly edge: Edge,
    public readonly headFilter?: NodeFilter,
  ) {
    super(edge);

    this.key = edge.name;
    this.score = 1 + (headFilter?.score ?? 0);
  }

  public equals(expression: unknown): expression is EdgeExistsFilter {
    return (
      expression instanceof EdgeExistsFilter &&
      expression.edge === this.edge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  @Memoize()
  public override get complement(): BooleanFilter | undefined {
    return this.headFilter
      ? new OrOperation([
          new NotOperation(new EdgeExistsFilter(this.edge)),
          new EdgeExistsFilter(this.edge, this.headFilter.complement),
        ])
      : undefined;
  }

  public override and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (operand instanceof EdgeExistsFilter && operand.edge === this.edge) {
      return EdgeExistsFilter.create(
        this.edge,
        this.headFilter && operand.headFilter
          ? new NodeFilter(
              this.edge.head,
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
    if (operand instanceof EdgeExistsFilter && operand.edge === this.edge) {
      return EdgeExistsFilter.create(
        this.edge,
        this.headFilter && operand.headFilter
          ? new NodeFilter(
              this.edge.head,
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
    const edgeHeadValue = value[this.edge.name];

    if (edgeHeadValue === undefined) {
      return;
    } else if (edgeHeadValue === null) {
      return false;
    }

    return this.headFilter
      ? this.headFilter.execute(edgeHeadValue, true)
      : true;
  }

  public override isExecutableWithinUniqueConstraint(
    unique: UniqueConstraint,
  ): boolean {
    return (
      unique.edgeSet.has(this.edge) &&
      (!this.headFilter ||
        this.headFilter.isExecutableWithinUniqueConstraint(
          this.edge.referencedUniqueConstraint,
        ))
    );
  }

  public get dependency() {
    return new EdgeDependencyGraph(this.edge, this.headFilter);
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
