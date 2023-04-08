import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import { JsonObject } from 'type-fest';
import type { MultipleReverseEdge } from '../../../../../definition/reverse-edge/multiple.js';
import {
  mergeDependencyTrees,
  type DependencyTree,
} from '../../../../../result-set.js';
import { NodeFilter, areFiltersEqual } from '../../../../filter.js';
import { areOrderingsEqual, type NodeOrdering } from '../../../../ordering.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type MultipleReverseEdgeHeadValue = NodeSelectedValue[];

export class MultipleReverseEdgeHeadSelection<
  TValue extends NodeSelectedValue = any,
> implements SelectionExpressionInterface<TValue[]>
{
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;
  public readonly headFilter?: NodeFilter;
  public readonly headOrdering?: NodeOrdering;
  public readonly offset?: number;

  public readonly dependencies: DependencyTree;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    alias: string | undefined,
    headFilter: NodeFilter | undefined,
    headOrdering: NodeOrdering | undefined,
    offset: number | undefined,
    public readonly limit: number,
    public readonly headSelection: NodeSelection<TValue>,
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

    this.dependencies = new Map([
      [
        reverseEdge,
        mergeDependencyTrees([
          new Map([[reverseEdge.originalEdge, undefined]]),
          this.headFilter?.dependencies,
          this.headOrdering?.dependencies,
          headSelection.dependencies,
        ]),
      ],
    ]);
  }

  public isAkinTo(
    expression: unknown,
  ): expression is MultipleReverseEdgeHeadSelection {
    return (
      expression instanceof MultipleReverseEdgeHeadSelection &&
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
  ): expression is MultipleReverseEdgeHeadSelection {
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
    expression: MultipleReverseEdgeHeadSelection,
    path?: utils.Path,
  ): MultipleReverseEdgeHeadSelection {
    assert(this.isAkinTo(expression));

    return new MultipleReverseEdgeHeadSelection(
      this.reverseEdge,
      this.alias,
      this.headFilter,
      this.headOrdering,
      this.offset,
      this.limit,
      this.headSelection.mergeWith(expression.headSelection, path),
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

  public parseValue(maybeValues: unknown, path?: utils.Path): TValue[] {
    if (!utils.isIterableObject(maybeValues)) {
      throw new utils.UnexpectedValueError(
        `an iterable of "${this.reverseEdge.name}"`,
        maybeValues,
        { path },
      );
    }

    return utils.aggregateGraphError<unknown, TValue[]>(
      maybeValues,
      (documents, maybeValue, index) => {
        documents.push(
          this.headSelection.parseValue(maybeValue, utils.addPath(path, index)),
        );

        return documents;
      },
      [],
      { path },
    );
  }

  public areValuesEqual(a: TValue[], b: TValue[]): boolean {
    return (
      a.length === b.length &&
      a.every((_item, index) =>
        this.headSelection.areValuesEqual(a[index], b[index]),
      )
    );
  }

  public serialize(maybeValues: unknown, path?: utils.Path): JsonObject[] {
    const values = this.parseValue(maybeValues, path);

    return values.map((value, index) =>
      this.headSelection.serialize(value, utils.addPath(path, index)),
    );
  }

  public stringify(maybeValues: unknown, path?: utils.Path): string {
    const values = this.parseValue(maybeValues, path);

    return `[${values
      .map((value, index) =>
        this.headSelection.stringify(value, utils.addPath(path, index)),
      )
      .join(',')}]`;
  }
}
