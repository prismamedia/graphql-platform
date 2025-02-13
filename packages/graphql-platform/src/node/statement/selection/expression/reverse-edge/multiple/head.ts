import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { JsonValue } from 'type-fest';
import { ReverseEdgeDependencyGraph } from '../../../../../change/dependency.js';
import type { MultipleReverseEdge } from '../../../../../definition.js';
import type { OperationContext } from '../../../../../operation.js';
import type {
  NodeFilterInputValue,
  OrderByInputValue,
} from '../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../filter.js';
import { NodeOrdering, areOrderingsEqual } from '../../../../ordering.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type MultipleReverseEdgeHeadValue = NodeSelectedValue[];

export class MultipleReverseEdgeHeadSelection<
  TSource extends NodeSelectedValue = any,
  TValue = TSource,
> implements SelectionExpressionInterface<TSource[], TValue[]>
{
  public readonly name: string;
  public readonly key: string;
  public readonly headFilter?: NodeFilter;
  public readonly headOrdering?: NodeOrdering;
  public readonly offset?: number;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly alias: string | undefined,
    headFilter: NodeFilter | NodeFilterInputValue | undefined,
    headOrdering: NodeOrdering | OrderByInputValue | undefined,
    offset: number | undefined,
    public readonly limit: number,
    public readonly headSelection: NodeSelection,
  ) {
    this.name = reverseEdge.name;
    this.key = this.alias ?? this.name;

    if (headFilter) {
      if (headFilter instanceof NodeFilter) {
        assert.strictEqual(reverseEdge.head, headFilter.node);

        this.headFilter = headFilter.normalized;
      } else {
        this.headFilter =
          reverseEdge.head.filterInputType.filter(headFilter).normalized;
      }
    }

    if (headOrdering) {
      if (headOrdering instanceof NodeOrdering) {
        assert.strictEqual(reverseEdge.head, headOrdering.node);

        this.headOrdering = headOrdering.normalized;
      } else {
        this.headOrdering =
          reverseEdge.head.orderingInputType.sort(headOrdering).normalized;
      }
    }

    this.offset = offset || undefined;

    assert.strictEqual(reverseEdge.head, headSelection.node);
  }

  public get hasVirtualSelection(): boolean {
    return this.headSelection.hasVirtualSelection;
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

  public get dependency() {
    return new ReverseEdgeDependencyGraph(
      this.reverseEdge,
      this.headFilter,
      this.headOrdering,
      this.headSelection,
    );
  }

  public get ast(): graphql.FieldNode {
    const argumentNodes: graphql.ConstArgumentNode[] = [];

    if (this.headFilter) {
      argumentNodes.push({
        kind: graphql.Kind.ARGUMENT,
        name: { kind: graphql.Kind.NAME, value: 'where' },
        value: this.headFilter.ast,
      });
    }

    if (this.headOrdering) {
      argumentNodes.push({
        kind: graphql.Kind.ARGUMENT,
        name: { kind: graphql.Kind.NAME, value: 'orderBy' },
        value: this.headOrdering.ast,
      });
    }

    if (this.offset !== undefined) {
      argumentNodes.push({
        kind: graphql.Kind.ARGUMENT,
        name: { kind: graphql.Kind.NAME, value: 'skip' },
        value: { kind: graphql.Kind.INT, value: String(this.offset) },
      });
    }

    argumentNodes.push({
      kind: graphql.Kind.ARGUMENT,
      name: { kind: graphql.Kind.NAME, value: 'first' },
      value: { kind: graphql.Kind.INT, value: String(this.limit) },
    });

    return {
      kind: graphql.Kind.FIELD,
      ...(this.alias && {
        alias: { kind: graphql.Kind.NAME, value: this.alias },
      }),
      name: { kind: graphql.Kind.NAME, value: this.name },
      ...(argumentNodes.length && { arguments: argumentNodes }),
      selectionSet: this.headSelection.ast,
    };
  }

  public parseSource(maybeSources: unknown, path?: utils.Path): TSource[] {
    if (!utils.isIterableObject(maybeSources)) {
      throw new utils.UnexpectedValueError(
        `an iterable of "${this.reverseEdge.name}"`,
        maybeSources,
        { path },
      );
    }

    return utils.aggregateGraphError<unknown, TSource[]>(
      maybeSources,
      (documents, maybeSource, index) => {
        documents.push(
          this.headSelection.parseSource(
            maybeSource,
            utils.addPath(path, index),
          ),
        );

        return documents;
      },
      [],
      { path },
    );
  }

  public async resolveValue(
    sources: ReadonlyArray<TSource>,
    context: OperationContext,
    path?: utils.Path,
  ): Promise<TValue[]> {
    return Promise.all(
      sources.map((source, index) =>
        this.headSelection.resolveValue(
          source,
          context,
          utils.addPath(path, index),
        ),
      ),
    );
  }

  public pickValue(
    superSetOfValues: ReadonlyArray<TValue>,
    path?: utils.Path,
  ): TValue[] {
    return superSetOfValues.map((superSetOfValue, index) =>
      this.headSelection.pickValue(superSetOfValue, utils.addPath(path, index)),
    );
  }

  public areValuesEqual(a: TValue[], b: TValue[]): boolean {
    return (
      a.length === b.length &&
      a.every((item, index) =>
        this.headSelection.areValuesEqual(item, b[index]),
      )
    );
  }

  public serialize(_value: TValue[], path: utils.Path): JsonValue {
    throw new utils.GraphError('Cannot be serialized', { path });
  }

  public unserialize(
    _value: JsonValue | undefined,
    path: utils.Path,
  ): TValue[] {
    throw new utils.GraphError('Cannot be unserialized', { path });
  }
}
