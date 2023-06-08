import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../../node.js';
import type { UniqueReverseEdge } from '../../../../../../definition/reverse-edge/unique.js';
import {
  mergeDependencyTrees,
  type DependencyTree,
} from '../../../../../../result-set.js';
import { NodeFilter, areFiltersEqual } from '../../../../../filter.js';
import type { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import type { AndOperand, OrOperand } from '../../../operation.js';
import { AndOperation, NotOperation, OrOperation } from '../../../operation.js';
import { FalseValue } from '../../../value.js';

export interface UniqueReverseEdgeExistsFilterAST {
  kind: 'UNIQUE_REVERSE_EDGE_EXISTS';
  reverseEdge: UniqueReverseEdge['name'];
  headFilter?: NodeFilter['ast'];
}

export class UniqueReverseEdgeExistsFilter
  implements BooleanExpressionInterface
{
  public static create(
    reverseEdge: UniqueReverseEdge,
    headFilter?: NodeFilter,
  ): BooleanFilter {
    headFilter && assert.equal(reverseEdge.head, headFilter.node);

    return headFilter?.isFalse()
      ? FalseValue
      : new this(reverseEdge, headFilter?.normalized);
  }

  public readonly score: number;
  public readonly dependencies: DependencyTree;

  protected constructor(
    public readonly reverseEdge: UniqueReverseEdge,
    public readonly headFilter?: NodeFilter,
  ) {
    this.score = 1 + (headFilter?.score ?? 0);
    this.dependencies = new Map([
      [
        reverseEdge,
        mergeDependencyTrees([
          new Map([[reverseEdge.originalEdge, undefined]]),
          headFilter?.dependencies,
        ]),
      ],
    ]);
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

  @Memoize()
  public get complement(): BooleanFilter | undefined {
    return this.headFilter
      ? new OrOperation(
          [
            new NotOperation(
              new UniqueReverseEdgeExistsFilter(this.reverseEdge),
            ),
            new UniqueReverseEdgeExistsFilter(
              this.reverseEdge,
              this.headFilter.complement,
            ),
          ],
          this,
        )
      : undefined;
  }

  public and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof UniqueReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return UniqueReverseEdgeExistsFilter.create(
        this.reverseEdge,
        new NodeFilter(
          this.reverseEdge.head,
          AndOperation.create(
            [this.headFilter?.filter, operand.headFilter?.filter],
            remainingReducers,
          ),
        ),
      );
    }
  }

  public or(
    operand: OrOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (
      operand instanceof UniqueReverseEdgeExistsFilter &&
      operand.reverseEdge === this.reverseEdge
    ) {
      return UniqueReverseEdgeExistsFilter.create(
        this.reverseEdge,
        new NodeFilter(
          this.reverseEdge.head,
          OrOperation.create(
            [this.headFilter?.filter, operand.headFilter?.filter],
            remainingReducers,
          ),
        ),
      );
    }
  }

  public get ast(): UniqueReverseEdgeExistsFilterAST {
    return {
      kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
      reverseEdge: this.reverseEdge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
    };
  }

  public execute(_nodeValue: Partial<NodeValue>): undefined {
    return;
  }
}
