import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../node.js';
import {
  NodeChange,
  NodeCreation,
  NodeDeletion,
  NodeUpdate,
} from '../../../../../change.js';
import type { MultipleReverseEdge } from '../../../../../definition.js';
import {
  BooleanFilter,
  MultipleReverseEdgeExistsFilter,
  OrOperation,
  areFiltersEqual,
  type NodeFilter,
} from '../../../../filter.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type MultipleReverseEdgeCountSelectionArgs = utils.Nillable<{
  filter?: NodeFilter;
}>;

export type MultipleReverseEdgeCountValue = number;

export class MultipleReverseEdgeCountSelection
  implements SelectionExpressionInterface<MultipleReverseEdgeCountValue>
{
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;
  public readonly headFilter?: NodeFilter;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    alias: string | undefined,
    headFilter: NodeFilter | undefined,
  ) {
    this.alias = alias || undefined;
    this.name = reverseEdge.countFieldName;
    this.key = this.alias ?? this.name;

    if (headFilter) {
      assert.equal(reverseEdge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }
  }

  public isAkinTo(
    expression: unknown,
  ): expression is MultipleReverseEdgeCountSelection {
    return (
      expression instanceof MultipleReverseEdgeCountSelection &&
      expression.reverseEdge === this.reverseEdge &&
      expression.alias === this.alias &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  public equals(
    expression: unknown,
  ): expression is MultipleReverseEdgeCountSelection {
    return this.isAkinTo(expression);
  }

  public isSupersetOf(expression: unknown): boolean {
    return this.isAkinTo(expression);
  }

  public mergeWith(
    expression: MultipleReverseEdgeCountSelection,
    _path?: utils.Path,
  ): this {
    assert(this.isAkinTo(expression));

    return this;
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
        if (this.headFilter?.execute(change.newValue, true) !== false) {
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
        }
      } else if (change instanceof NodeDeletion) {
        if (this.headFilter?.execute(change.oldValue, true) !== false) {
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
        }
      } else if (
        change.hasComponentUpdate(this.reverseEdge.originalEdge) ||
        this.headFilter?.isAffectedByNodeUpdate(change)
      ) {
        if (this.headFilter?.execute(change.newValue, true) !== false) {
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
        }

        if (this.headFilter?.execute(change.oldValue, true) !== false) {
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
    }

    if (this.headFilter) {
      operands.push(
        MultipleReverseEdgeExistsFilter.create(
          this.reverseEdge,
          this.headFilter.getAffectedGraphByNodeChange(change),
        ),
      );
    }

    return OrOperation.create(operands);
  }

  @Memoize()
  public toGraphQLFieldNode(): graphql.FieldNode {
    return {
      kind: graphql.Kind.FIELD,
      alias: this.alias
        ? {
            kind: graphql.Kind.NAME,
            value: this.alias,
          }
        : undefined,
      name: {
        kind: graphql.Kind.NAME,
        value: this.name,
      },
    };
  }

  public parseValue(
    maybeValue: unknown,
    path?: utils.Path,
  ): MultipleReverseEdgeCountValue {
    if (maybeValue == null) {
      throw new utils.UnexpectedValueError(
        `a non-nil "${scalars.typesByName.UnsignedInt}"`,
        maybeValue,
        { path },
      );
    }

    return utils.parseGraphQLScalarValue(
      scalars.typesByName.UnsignedInt,
      maybeValue,
      path,
    )!;
  }

  public areValuesEqual(
    a: MultipleReverseEdgeCountValue,
    b: MultipleReverseEdgeCountValue,
  ): boolean {
    return a === b;
  }

  public serialize(maybeValue: unknown, path?: utils.Path): number {
    return this.parseValue(maybeValue, path);
  }

  public stringify(maybeValue: unknown, path?: utils.Path): string {
    return JSON.stringify(this.serialize(maybeValue, path));
  }
}
