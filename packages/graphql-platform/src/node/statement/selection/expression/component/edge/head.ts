import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { JsonObject } from 'type-fest';
import type { Component, Edge } from '../../../../../definition.js';
import { DependencyGraph } from '../../../../../operation/dependency-graph.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type EdgeHeadValue = null | NodeSelectedValue;

export class EdgeHeadSelection<TValue extends EdgeHeadValue = any>
  implements SelectionExpressionInterface<TValue>
{
  public readonly component: Component;
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;

  public readonly dependencies: DependencyGraph;

  public constructor(
    public readonly edge: Edge,
    alias: string | undefined,
    public readonly headSelection: NodeSelection<NonNullable<TValue>>,
  ) {
    this.component = edge;
    this.alias = alias || undefined;
    this.name = edge.name;
    this.key = this.alias ?? this.name;

    assert.equal(edge.head, headSelection.node);

    this.dependencies = DependencyGraph.fromEdge(
      edge,
      headSelection.dependencies,
    );
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
        `a non-undefined "${this.edge.head}"`,
        maybeValue,
        { path },
      );
    } else if (maybeValue === null) {
      if (!this.edge.isNullable()) {
        throw new utils.UnexpectedValueError(
          `a non-null "${this.edge.head}"`,
          maybeValue,
          { path },
        );
      }

      return null as TValue;
    }

    return this.headSelection.parseValue(maybeValue, path);
  }

  public areValuesEqual(a: TValue, b: TValue): boolean {
    return a === null || b === null
      ? a === b
      : this.headSelection.areValuesEqual(a, b);
  }

  public uniqValues(values: ReadonlyArray<TValue>): TValue[] {
    return R.uniqWith(values, (a, b) => this.areValuesEqual(a, b));
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
