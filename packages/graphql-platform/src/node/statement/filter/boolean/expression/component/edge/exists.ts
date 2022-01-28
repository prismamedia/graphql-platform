import assert from 'node:assert/strict';
import type { Edge } from '../../../../../../definition/component/edge.js';
import { areFiltersEqual, NodeFilter } from '../../../../../filter.js';
import { BooleanFilter } from '../../../../boolean.js';
import type { BooleanExpressionInterface } from '../../../expression-interface.js';
import { AndOperation, NotOperation, OrOperation } from '../../../operation.js';
import { BooleanValue } from '../../../value.js';

export interface EdgeExistsFilterAST {
  kind: 'EdgeExistsFilter';
  edge: Edge['name'];
  headFilter?: NodeFilter['ast'];
}

export class EdgeExistsFilter implements BooleanExpressionInterface {
  public readonly headFilter?: NodeFilter;
  public readonly reduced: BooleanValue | this;

  public constructor(public readonly edge: Edge, headFilter?: NodeFilter) {
    if (headFilter) {
      assert.equal(edge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }

    this.reduced = this.headFilter?.isFalse() ? new BooleanValue(false) : this;
  }

  public equals(expression: unknown): boolean {
    return (
      expression instanceof EdgeExistsFilter &&
      expression.edge === this.edge &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  public and(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof EdgeExistsFilter &&
      expression.edge === this.edge
    ) {
      return new EdgeExistsFilter(
        this.edge,
        new NodeFilter(
          this.edge.head,
          new AndOperation([
            this.headFilter?.filter,
            expression.headFilter?.filter,
          ]),
        ),
      );
    } else if (
      expression instanceof NotOperation &&
      expression.operand instanceof EdgeExistsFilter &&
      expression.operand.edge === this.edge
    ) {
      if (!expression.operand.headFilter) {
        return new BooleanValue(false);
      }
    }
  }

  public or(expression: unknown): BooleanFilter | undefined {
    if (
      expression instanceof EdgeExistsFilter &&
      expression.edge === this.edge
    ) {
      return new EdgeExistsFilter(
        this.edge,
        new NodeFilter(
          this.edge.head,
          new OrOperation([
            this.headFilter?.filter,
            expression.headFilter?.filter,
          ]),
        ),
      );
    }
  }

  public get ast(): EdgeExistsFilterAST {
    return {
      kind: 'EdgeExistsFilter',
      edge: this.edge.name,
      ...(this.headFilter && { headFilter: this.headFilter.ast }),
    };
  }
}
