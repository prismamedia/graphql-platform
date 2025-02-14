import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { JsonValue } from 'type-fest';
import { EdgeDependencyGraph } from '../../../../../change/dependency.js';
import type { Component, Edge } from '../../../../../definition.js';
import type { OperationContext } from '../../../../../operation.js';
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

    assert.strictEqual(edge.head, headSelection.node);
  }

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

  public get dependency() {
    return new EdgeDependencyGraph(this.edge, undefined, this.headSelection);
  }

  public get ast(): graphql.FieldNode {
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
      selectionSet: this.headSelection.ast,
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

  public serialize(value: TValue, path?: utils.Path): JsonValue {
    return value == null ? null : this.headSelection.serialize(value, path);
  }

  public unserialize(value: JsonValue | undefined, path?: utils.Path): TValue {
    if (value == null) {
      if (!this.edge.isNullable()) {
        throw new utils.UnexpectedValueError(
          `a non-null "${this.edge.head}"`,
          value,
          { path },
        );
      }

      return null as TValue;
    }

    return this.headSelection.unserialize(value, path);
  }
}
