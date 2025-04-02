import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import { ReverseEdgeDependencyGraph } from '../../../../../change/dependency.js';
import type { UniqueReverseEdge } from '../../../../../definition.js';
import type { OperationContext } from '../../../../../operation.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type UniqueReverseEdgeHeadValue = null | NodeSelectedValue;

export class UniqueReverseEdgeHeadSelection<
  TSource extends UniqueReverseEdgeHeadValue = any,
  TValue = TSource,
> implements SelectionExpressionInterface<TSource, TValue>
{
  public readonly name: string;
  public readonly key: string;

  public constructor(
    public readonly reverseEdge: UniqueReverseEdge,
    public readonly alias: string | undefined,
    public readonly headSelection: NodeSelection,
  ) {
    this.name = reverseEdge.name;
    this.key = this.alias ?? this.name;

    assert.strictEqual(reverseEdge.head, headSelection.node);
  }

  public get hasVirtualSelection(): boolean {
    return this.headSelection.hasVirtualSelection;
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

  public get dependency() {
    return new ReverseEdgeDependencyGraph(
      this.reverseEdge,
      undefined,
      undefined,
      this.headSelection,
    );
  }

  public get ast(): graphql.FieldNode {
    return {
      kind: graphql.Kind.FIELD,
      ...(this.alias && {
        alias: { kind: graphql.Kind.NAME, value: this.alias },
      }),
      name: { kind: graphql.Kind.NAME, value: this.name },
      selectionSet: this.headSelection.ast,
    };
  }

  public parseSource(maybeSource: unknown, path?: utils.Path): TSource {
    if (maybeSource === undefined) {
      throw new utils.UnexpectedValueError(
        `a non-undefined "${this.reverseEdge.head}"`,
        maybeSource,
        { path },
      );
    }

    return maybeSource === null
      ? (null as TSource)
      : this.headSelection.parseSource(maybeSource, path);
  }

  public async resolveValue(
    source: TSource,
    context: OperationContext,
    path?: utils.Path,
  ): Promise<TValue> {
    return source
      ? this.headSelection.resolveValue(source, context, path)
      : (null as TValue);
  }

  public pickValue(superSetOfValue: TValue, path?: utils.Path): TValue {
    return superSetOfValue
      ? this.headSelection.pickValue(superSetOfValue, path)
      : (null as TValue);
  }

  public areValuesEqual(a: TValue, b: TValue): boolean {
    return a === null || b === null
      ? a === b
      : this.headSelection.areValuesEqual(a, b);
  }

  public serialize(value: TValue, path?: utils.Path): JsonObject | null {
    return value === null ? null : this.headSelection.serialize(value, path);
  }

  public unserialize(value: JsonObject | null, path?: utils.Path): TValue {
    return value === null
      ? (null as TValue)
      : this.headSelection.unserialize(value, path);
  }
}
