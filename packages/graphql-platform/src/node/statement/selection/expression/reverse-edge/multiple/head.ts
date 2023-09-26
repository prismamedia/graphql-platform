import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import { JsonObject } from 'type-fest';
import type { MultipleReverseEdge } from '../../../../../definition.js';
import { DependencyGraph } from '../../../../../operation/dependency-graph.js';
import { areFiltersEqual, type NodeFilter } from '../../../../filter.js';
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

  public readonly dependencies: DependencyGraph;

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

    this.dependencies = DependencyGraph.fromReverseEdge(
      reverseEdge,
      this.headFilter?.dependencies,
      this.headOrdering?.dependencies,
      headSelection?.dependencies,
    );
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

  public isSupersetOf(expression: unknown): boolean {
    return (
      this.isAkinTo(expression) &&
      this.headSelection.isSupersetOf(expression.headSelection)
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
  public toGraphQLFieldNode(): graphql.FieldNode {
    const argumentNodes: graphql.ArgumentNode[] = [];

    if (this.offset !== undefined) {
      argumentNodes.push({
        kind: graphql.Kind.ARGUMENT,
        name: {
          kind: graphql.Kind.NAME,
          value: 'skip',
        },
        value: {
          kind: graphql.Kind.INT,
          value: String(this.offset),
        },
      });
    }

    argumentNodes.push({
      kind: graphql.Kind.ARGUMENT,
      name: {
        kind: graphql.Kind.NAME,
        value: 'first',
      },
      value: {
        kind: graphql.Kind.INT,
        value: String(this.limit),
      },
    });

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
      arguments: argumentNodes,
      selectionSet: this.headSelection.toGraphQLSelectionSetNode(),
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
