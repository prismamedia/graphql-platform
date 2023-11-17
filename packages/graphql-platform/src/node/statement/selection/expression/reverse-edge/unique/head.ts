import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { JsonObject } from 'type-fest';
import type { NodeValue } from '../../../../../../node.js';
import {
  NodeChange,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../../../../../change.js';
import type { UniqueReverseEdge } from '../../../../../definition.js';
import {
  OrOperation,
  UniqueReverseEdgeExistsFilter,
  type BooleanFilter,
} from '../../../../filter.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type UniqueReverseEdgeHeadValue = null | NodeSelectedValue;

export class UniqueReverseEdgeHeadSelection<
  TValue extends UniqueReverseEdgeHeadValue = any,
> implements SelectionExpressionInterface<TValue>
{
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;

  public constructor(
    public readonly reverseEdge: UniqueReverseEdge,
    alias: string | undefined,
    public readonly headSelection: NodeSelection<NonNullable<TValue>>,
  ) {
    this.alias = alias || undefined;
    this.name = reverseEdge.name;
    this.key = this.alias ?? this.name;

    assert.equal(reverseEdge.head, headSelection.node);
  }

  public isAkinTo(
    expression: unknown,
  ): expression is UniqueReverseEdgeHeadSelection {
    return (
      expression instanceof UniqueReverseEdgeHeadSelection &&
      expression.reverseEdge === this.reverseEdge &&
      expression.alias === this.alias
    );
  }

  public equals(
    expression: unknown,
  ): expression is UniqueReverseEdgeHeadSelection {
    return (
      this.isAkinTo(expression) &&
      expression.headSelection.equals(this.headSelection)
    );
  }

  public isSupersetOf(expression: unknown): boolean {
    return (
      this.isAkinTo(expression) &&
      this.headSelection.isSupersetOf(expression.headSelection)
    );
  }

  public mergeWith(
    expression: UniqueReverseEdgeHeadSelection,
    path?: utils.Path,
  ): UniqueReverseEdgeHeadSelection {
    assert(this.isAkinTo(expression));

    return new UniqueReverseEdgeHeadSelection(
      this.reverseEdge,
      this.alias,
      this.headSelection.mergeWith(expression.headSelection, path),
    );
  }

  public isAffectedByNodeUpdate(_update: NodeUpdate): boolean {
    return false;
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter {
    const operands: BooleanFilter[] = [];

    if (change.node === this.reverseEdge.head) {
      if (change instanceof NodeCreation) {
        const tailFilter = this.reverseEdge.tail.filterInputType.filter(
          change.newValue[this.reverseEdge.originalEdge.name],
        );

        if (
          !tailFilter.isFalse() &&
          !visitedRootNodes?.some((visitedRootNode) =>
            tailFilter.execute(visitedRootNode, false),
          )
        ) {
          operands.push(tailFilter.filter);
        }
      } else if (change instanceof NodeDeletion) {
        const tailFilter = this.reverseEdge.tail.filterInputType.filter(
          change.oldValue[this.reverseEdge.originalEdge.name],
        );

        if (
          !tailFilter.isFalse() &&
          !visitedRootNodes?.some((visitedRootNode) =>
            tailFilter.execute(visitedRootNode, false),
          )
        ) {
          operands.push(tailFilter.filter);
        }
      } else if (
        change.hasComponentUpdate(this.reverseEdge.originalEdge) ||
        this.headSelection.isAffectedByNodeUpdate(change)
      ) {
        const newTailFilter = this.reverseEdge.tail.filterInputType.filter(
          change.newValue[this.reverseEdge.originalEdge.name],
        );

        if (
          !newTailFilter.isFalse() &&
          !visitedRootNodes?.some((visitedRootNode) =>
            newTailFilter.execute(visitedRootNode, false),
          )
        ) {
          operands.push(newTailFilter.filter);
        }

        const oldTailFilter = this.reverseEdge.tail.filterInputType.filter(
          change.oldValue[this.reverseEdge.originalEdge.name],
        );

        if (
          !oldTailFilter.isFalse() &&
          !visitedRootNodes?.some((visitedRootNode) =>
            oldTailFilter.execute(visitedRootNode, false),
          )
        ) {
          operands.push(oldTailFilter.filter);
        }
      }
    }

    operands.push(
      UniqueReverseEdgeExistsFilter.create(
        this.reverseEdge,
        this.headSelection.getAffectedGraphByNodeChange(change),
      ),
    );

    return OrOperation.create(operands);
  }

  @Memoize()
  public toGraphQLFieldNode(): graphql.FieldNode {
    return {
      kind: graphql.Kind.FIELD,
      name: {
        kind: graphql.Kind.NAME,
        value: this.name,
      },
      selectionSet: this.headSelection.toGraphQLSelectionSetNode(),
    };
  }

  public parseValue(maybeValue: unknown, path?: utils.Path): TValue {
    if (maybeValue === undefined) {
      throw new utils.UnexpectedValueError(
        `a non-undefined "${this.reverseEdge.head}"`,
        maybeValue,
        { path },
      );
    }

    return maybeValue === null
      ? (null as TValue)
      : this.headSelection.parseValue(maybeValue, path);
  }

  public areValuesEqual(a: TValue, b: TValue): boolean {
    return a === null || b === null
      ? a === b
      : this.headSelection.areValuesEqual(a, b);
  }

  public serialize(maybeValue: unknown, path?: utils.Path): JsonObject | null {
    const value = this.parseValue(maybeValue, path);

    return value === null ? null : this.headSelection.serialize(value, path);
  }

  public stringify(maybeValue: unknown, path?: utils.Path): string {
    const value = this.parseValue(maybeValue, path);

    return value === null ? 'null' : this.headSelection.stringify(value, path);
  }
}
