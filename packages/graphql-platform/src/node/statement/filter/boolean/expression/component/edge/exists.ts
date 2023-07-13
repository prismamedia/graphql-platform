import { Memoize } from '@prismamedia/memoize';
import assert from 'node:assert/strict';
import type { Component, Edge } from '../../../../../../definition.js';
import { DependencyGraph } from '../../../../../../subscription.js';
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
    headFilter && assert.equal(edge.head, headFilter.node);

    return headFilter?.isFalse()
      ? FalseValue
      : new this(edge, headFilter?.normalized);
  }

  public readonly key: string;

  public readonly component: Component;
  public readonly score: number;
  public readonly dependencies: DependencyGraph;

  protected constructor(
    public readonly edge: Edge,
    public readonly headFilter?: NodeFilter,
  ) {
    this.key = edge.name;

    this.component = edge;
    this.score = 1 + (headFilter?.score ?? 0);
    this.dependencies = DependencyGraph.fromEdge(
      this,
      headFilter?.dependencies,
    );
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
    return this.headFilter?.filter
      ? new OrOperation(
          [
            new NotOperation(new EdgeExistsFilter(this.edge)),
            new EdgeExistsFilter(this.edge, this.headFilter.complement),
          ],
          this,
        )
      : undefined;
  }

  public and(
    operand: AndOperand,
    remainingReducers: number,
  ): BooleanFilter | undefined {
    if (operand instanceof EdgeExistsFilter && operand.edge === this.edge) {
      return EdgeExistsFilter.create(
        this.edge,
        new NodeFilter(
          this.edge.head,
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
    if (operand instanceof EdgeExistsFilter && operand.edge === this.edge) {
      return EdgeExistsFilter.create(
        this.edge,
        new NodeFilter(
          this.edge.head,
          OrOperation.create(
            [this.headFilter?.filter, operand.headFilter?.filter],
            remainingReducers,
          ),
        ),
      );
    }
  }

  public execute(value: NodeSelectedValue): boolean | undefined {
    const edgeValue = value[this.edge.name];
    if (edgeValue === undefined) {
      return;
    }

    if (!edgeValue) {
      return false;
    }

    return this.headFilter ? this.headFilter.execute(edgeValue, true) : true;
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
