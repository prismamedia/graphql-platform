import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert';
import { ReverseEdgeDependencyGraph } from '../../../../../change/dependency.js';
import type { MultipleReverseEdge } from '../../../../../definition.js';
import type { OperationContext } from '../../../../../operation.js';
import type { NodeFilterInputValue } from '../../../../../type.js';
import { NodeFilter, areFiltersEqual } from '../../../../filter.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type MultipleReverseEdgeCountSelectionArgs = utils.Nillable<{
  filter?: NodeFilter;
}>;

export type MultipleReverseEdgeCountValue = number;

export class MultipleReverseEdgeCountSelection<
  TSource extends MultipleReverseEdgeCountValue = any,
  TValue = TSource,
> implements SelectionExpressionInterface<TSource, TValue>
{
  public readonly name: string;
  public readonly key: string;
  public readonly headFilter?: NodeFilter;

  public constructor(
    public readonly reverseEdge: MultipleReverseEdge,
    public readonly alias: string | undefined,
    headFilter: NodeFilter | NodeFilterInputValue | undefined,
  ) {
    this.name = reverseEdge.countFieldName;
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
  }

  public get hasVirtualSelection(): boolean {
    return false;
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

  public get dependency() {
    return new ReverseEdgeDependencyGraph(this.reverseEdge, this.headFilter);
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

    return {
      kind: graphql.Kind.FIELD,
      ...(this.alias && {
        alias: { kind: graphql.Kind.NAME, value: this.alias },
      }),
      name: { kind: graphql.Kind.NAME, value: this.name },
      ...(argumentNodes.length && { arguments: argumentNodes }),
    };
  }

  public parseSource(source: unknown, path?: utils.Path): TSource {
    if (source == null) {
      throw new utils.UnexpectedValueError(
        `a non-nil "${scalars.typesByName.UnsignedInt}"`,
        source,
        { path },
      );
    }

    return scalars.parseUnsignedInt(source, path) as any;
  }

  public resolveValue(
    source: TSource,
    _context: OperationContext,
    _path?: utils.Path,
  ): TValue {
    return source as any;
  }

  public pickValue(superSetOfValue: TValue, _path?: utils.Path): TValue {
    return superSetOfValue;
  }

  public areValuesEqual(a: TValue, b: TValue): boolean {
    return a === b;
  }

  public serialize(value: TValue, path?: utils.Path): number {
    return scalars.parseUnsignedInt(value, path);
  }

  public unserialize(value: number, path?: utils.Path): TValue {
    return scalars.parseUnsignedInt(value, path) as TValue;
  }
}
