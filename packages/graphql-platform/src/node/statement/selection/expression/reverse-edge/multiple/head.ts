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
import type { OperationContext } from '../../../../../operation.js';
import {
  MultipleReverseEdgeExistsFilter,
  NodeFilter,
  OrOperation,
  areFiltersEqual,
  type BooleanFilter,
} from '../../../../filter.js';
import { areOrderingsEqual, type NodeOrdering } from '../../../../ordering.js';
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
    headFilter: NodeFilter | undefined,
    headOrdering: NodeOrdering | undefined,
    offset: number | undefined,
    public readonly limit: number,
    public readonly headSelection: NodeSelection,
  ) {
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

  @Memoize()
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
        this.headFilter?.isAffectedByNodeUpdate(change) ||
        this.headOrdering?.isAffectedByNodeUpdate(change) ||
        this.headSelection.isAffectedByNodeUpdate(change)
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

    operands.push(
      MultipleReverseEdgeExistsFilter.create(
        this.reverseEdge,
        new NodeFilter(
          this.reverseEdge.head,
          OrOperation.create([
            this.headFilter?.getAffectedGraphByNodeChange(change).filter ??
              null,
            this.headOrdering?.getAffectedGraphByNodeChange(change).filter ??
              null,
            this.headSelection.getAffectedGraphByNodeChange(change).filter,
          ]),
        ),
      ),
    );

    return OrOperation.create(operands);
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
      ...(this.alias && {
        alias: {
          kind: graphql.Kind.NAME,
          value: this.alias,
        },
      }),
      name: {
        kind: graphql.Kind.NAME,
        value: this.name,
      },
      arguments: argumentNodes,
      selectionSet: this.headSelection.toGraphQLSelectionSetNode(),
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
    sources: TSource[],
    context: OperationContext,
    path: utils.Path,
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

  public pickValue(superSetOfValues: TValue[]): TValue[] {
    return superSetOfValues.map((superSetOfValue) =>
      this.headSelection.pickValue(superSetOfValue),
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
}
