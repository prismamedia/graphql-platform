import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ReverseEdgeMultiple } from '../../../../../definition/reverse-edge/multiple.js';
import { areFiltersEqual, NodeFilter } from '../../../../filter.js';
import { areOrderingsEqual, type NodeOrdering } from '../../../../ordering.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export class ReverseEdgeMultipleHeadSelection
  implements SelectionExpressionInterface
{
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;
  public readonly headFilter?: NodeFilter;
  public readonly headOrdering?: NodeOrdering;
  public readonly offset?: number;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    alias: string | undefined,
    headFilter: NodeFilter | undefined,
    headOrdering: NodeOrdering | undefined,
    offset: number | undefined,
    public readonly limit: number,
    public readonly headSelection: NodeSelection,
  ) {
    this.alias = alias || undefined;
    this.name = reverseEdge.name;
    this.key = this.alias ?? this.name;

    if (headFilter) {
      assert.equal(reverseEdge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }

    if (headOrdering) {
      assert.equal(reverseEdge.head, headOrdering.node);

      this.headOrdering = headOrdering.normalized;
    }

    this.offset = offset || undefined;

    assert.equal(reverseEdge.head, headSelection.node);
  }

  public isAkinTo(
    expression: unknown,
  ): expression is ReverseEdgeMultipleHeadSelection {
    return (
      expression instanceof ReverseEdgeMultipleHeadSelection &&
      expression.reverseEdge === this.reverseEdge &&
      expression.alias === this.alias &&
      areFiltersEqual(expression.headFilter, this.headFilter) &&
      areOrderingsEqual(expression.headOrdering, this.headOrdering) &&
      expression.offset === this.offset &&
      expression.limit === this.limit
    );
  }

  public equals(
    expression: unknown,
  ): expression is ReverseEdgeMultipleHeadSelection {
    return (
      this.isAkinTo(expression) &&
      expression.headSelection.equals(this.headSelection)
    );
  }

  public includes(expression: unknown): boolean {
    return (
      this.isAkinTo(expression) &&
      this.headSelection.includes(expression.headSelection)
    );
  }

  public mergeWith(
    expression: ReverseEdgeMultipleHeadSelection,
    path?: utils.Path,
  ): ReverseEdgeMultipleHeadSelection {
    assert(this.isAkinTo(expression));

    return new ReverseEdgeMultipleHeadSelection(
      this.reverseEdge,
      this.alias,
      this.headFilter,
      this.headOrdering,
      this.offset,
      this.limit,
      this.headSelection.mergeWith(expression.headSelection, path),
    );
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path,
  ): NodeSelectedValue[] {
    if (!utils.isIterableObject(maybeValue)) {
      throw new utils.UnexpectedValueError(
        `an iterable of "${this.reverseEdge.name}"`,
        maybeValue,
        { path },
      );
    }

    return utils.aggregateGraphError<unknown, NodeSelectedValue[]>(
      maybeValue,
      (nodeValues, maybeItem, index) => [
        ...nodeValues,
        this.headSelection.parseValue(maybeItem, utils.addPath(path, index)),
      ],
      [],
      { path },
    );
  }

  @Memoize()
  public toGraphQLField(): graphql.FieldNode {
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
      arguments: [
        {
          kind: graphql.Kind.ARGUMENT,
          name: {
            kind: graphql.Kind.NAME,
            value: 'first',
          },
          value: {
            kind: graphql.Kind.INT,
            value: String(this.limit),
          },
        },
      ],
      selectionSet: this.headSelection.toGraphQLSelectionSet(),
    };
  }
}
