import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../../node.js';
import { NodeUpdate, type NodeChange } from '../../../../../change.js';
import type { Component, Edge } from '../../../../../definition.js';
import type { OperationContext } from '../../../../../operation.js';
import {
  EdgeExistsFilter,
  NodeFilter,
  OrOperation,
  type BooleanFilter,
} from '../../../../filter.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type EdgeHeadValue = null | NodeSelectedValue;

export class EdgeHeadSelection<
  TSource extends EdgeHeadValue = any,
  TValue = TSource,
> implements SelectionExpressionInterface<TSource, TValue>
{
  public readonly component: Component;
  public readonly name: string;
  public readonly key: string;

  public constructor(
    public readonly edge: Edge,
    public readonly alias: string | undefined,
    public readonly headSelection: NodeSelection,
  ) {
    this.component = edge;
    this.name = edge.name;
    this.key = this.alias ?? this.name;

    assert.equal(edge.head, headSelection.node);
  }

  @Memoize()
  public get hasVirtualSelection(): boolean {
    return this.headSelection.hasVirtualSelection;
  }

  public isAkinTo(expression: unknown): expression is EdgeHeadSelection {
    return (
      expression instanceof EdgeHeadSelection &&
      expression.edge === this.edge &&
      expression.alias === this.alias
    );
  }

  public equals(expression: unknown): expression is EdgeHeadSelection {
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
    expression: EdgeHeadSelection,
    path?: utils.Path,
  ): this | EdgeHeadSelection {
    assert(this.isAkinTo(expression));

    return new EdgeHeadSelection(
      this.edge,
      this.alias,
      this.headSelection.mergeWith(expression.headSelection, path),
    );
  }

  public isAffectedByNodeUpdate(update: NodeUpdate): boolean {
    return update.hasComponentUpdate(this.edge);
  }

  public getAffectedGraphByNodeChange(
    change: NodeChange,
    _visitedRootNodes?: NodeValue[],
  ): BooleanFilter | null {
    const operands: BooleanFilter[] = [];

    if (
      change.node === this.edge.head &&
      change instanceof NodeUpdate &&
      this.headSelection.isAffectedByNodeUpdate(change)
    ) {
      operands.push(
        this.edge.head.filterInputType.filter(
          this.edge.referencedUniqueConstraint.parseValue(change.newValue),
        ).filter,
      );
    }

    {
      const affectedHeadSelection =
        this.headSelection.getAffectedGraphByNodeChange(change);

      if (affectedHeadSelection) {
        operands.push(affectedHeadSelection.filter);
      }
    }

    return operands.length
      ? EdgeExistsFilter.create(
          this.edge,
          new NodeFilter(this.edge.head, OrOperation.create(operands)),
        )
      : null;
  }

  @Memoize()
  public toGraphQLFieldNode(): graphql.FieldNode {
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
      selectionSet: this.headSelection.toGraphQLSelectionSetNode(),
    };
  }

  public parseSource(
    maybeSource: unknown,
    path: utils.Path = utils.addPath(undefined, this.edge.toString()),
  ): TSource {
    if (maybeSource === undefined) {
      throw new utils.UnexpectedValueError(
        `a non-undefined "${this.edge.head}"`,
        maybeSource,
        { path },
      );
    } else if (maybeSource === null) {
      if (!this.edge.isNullable()) {
        throw new utils.UnexpectedValueError(
          `a non-null "${this.edge.head}"`,
          maybeSource,
          { path },
        );
      }

      return null as TSource;
    }

    return this.headSelection.parseSource(maybeSource, path);
  }

  public async resolveValue(
    source: TSource,
    context: OperationContext,
    path?: utils.Path,
  ): Promise<TValue> {
    return source
      ? this.headSelection.resolveValue(source, context, path)
      : null;
  }

  public pickValue(superSetOfValue: TValue, path?: utils.Path): TValue {
    return superSetOfValue
      ? this.headSelection.pickValue(superSetOfValue, path)
      : null;
  }

  public areValuesEqual(a: TValue, b: TValue): boolean {
    return a === null || b === null
      ? a === b
      : this.headSelection.areValuesEqual(a, b);
  }
}
