import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import { NodeValue } from '../../../../../../../node.js';
import { NodeChange, NodeUpdate } from '../../../../../../change.js';
import type {
  Component,
  Edge,
  UniqueConstraint,
} from '../../../../../../definition.js';
import type { NodeFilterInputValue } from '../../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { NodeSelectedValue } from '../../../../../selection.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import type { AndOperand, OrOperand } from '../../../operation.js';
import { AndOperation, NotOperation, OrOperation } from '../../../operation.js';
import { FalseValue, TrueValue } from '../../../value.js';

export interface EdgeExistsFilterAST {
  kind: 'EDGE_EXISTS';
  edge: Edge['name'];
  headFilter?: NodeFilter['ast'];
}

export class EdgeExistsFilter implements BooleanExpressionInterface {
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

  public readonly component: Component;
  public readonly score: number;

  protected constructor(
    public readonly edge: Edge,
    public readonly headFilter?: NodeFilter,
  ) {
    this.key = edge.name;

    this.component = edge;
    this.score = 1 + (headFilter?.score ?? 0);
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof EdgeExistsFilter &&
      expression.edge === this.edge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  @Memoize()
  public get complement(): BooleanFilter | undefined {
    return this.headFilter
      ? new OrOperation([
          new NotOperation(new EdgeExistsFilter(this.edge)),
          new EdgeExistsFilter(this.edge, this.headFilter.complement),
        ])
      : undefined;
  }

  public and(
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

  public or(
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

  public execute(value: NodeSelectedValue): boolean | undefined {
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

  public isExecutableWithinUniqueConstraint(unique: UniqueConstraint): boolean {
    return (
      unique.edgeSet.has(this.edge) &&
      (!this.headFilter ||
        this.headFilter.isExecutableWithinUniqueConstraint(
          this.edge.referencedUniqueConstraint,
        ))
    );
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return (
      update.hasComponentUpdate(this.edge) &&
      this.execute(update.oldValue) !== this.execute(update.newValue)
    );
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    _visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    return this.headFilter
      ? EdgeExistsFilter.create(
          this.edge,
          new NodeFilter(
            this.edge.head,
            OrOperation.create([
              change.node === this.edge.head &&
              change instanceof NodeUpdate &&
              this.headFilter.isAffectedByNodeUpdate(change)
                ? this.edge.head.filterInputType.filter(
                    this.edge.referencedUniqueConstraint.parseValue(
                      change.newValue,
                    ),
                  ).filter
                : FalseValue,
              this.headFilter.getAffectedGraphByNodeChange(change).filter,
            ]),
          ),
        )
      : FalseValue;
  }

  public get ast(): EdgeExistsFilterAST {
    return {
      kind: 'EDGE_EXISTS',
      edge: this.edge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
    };
  }

  public get inputValue(): NodeFilterInputValue {
    return {
      [this.key]: this.headFilter
        ? this.headFilter.inputValue
        : TrueValue.inputValue,
    };
  }
}
