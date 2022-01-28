import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  Nillable,
  parseGraphQLScalarValue,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ReverseEdgeMultiple } from '../../../../definition/reverse-edge/multiple.js';
import { areFiltersEqual, NodeFilter } from '../../../filter.js';
import type { SelectionExpressionInterface } from '../../expression-interface.js';

export type ReverseEdgeMultipleCountSelectionArgs = Nillable<{
  filter?: NodeFilter;
}>;

export class ReverseEdgeMultipleCountSelection
  implements SelectionExpressionInterface
{
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;
  public readonly headFilter?: NodeFilter;

  public constructor(
    public readonly reverseEdge: ReverseEdgeMultiple,
    alias: string | undefined,
    headFilter: NodeFilter | undefined,
  ) {
    this.alias = alias || undefined;
    this.name = reverseEdge.countFieldName;
    this.key = this.alias ?? this.name;

    if (headFilter) {
      assert.equal(reverseEdge.head, headFilter.node);

      this.headFilter = headFilter.normalized;
    }
  }

  public isAkinTo(
    expression: unknown,
  ): expression is ReverseEdgeMultipleCountSelection {
    return (
      expression instanceof ReverseEdgeMultipleCountSelection &&
      expression.reverseEdge === this.reverseEdge &&
      expression.alias === this.alias &&
      areFiltersEqual(expression.headFilter, this.headFilter)
    );
  }

  public equals(
    expression: unknown,
  ): expression is ReverseEdgeMultipleCountSelection {
    return this.isAkinTo(expression);
  }

  public includes(expression: unknown): boolean {
    return this.isAkinTo(expression);
  }

  public mergeWith(
    expression: ReverseEdgeMultipleCountSelection,
    path?: Path,
  ): this {
    if (!this.equals(expression)) {
      throw new UnexpectedValueError(
        `a(n) "${this.reverseEdge}"'s count-selection`,
        expression,
        { path },
      );
    }

    return this;
  }

  public parseValue(maybeValue: unknown, path: Path): number {
    if (maybeValue == null) {
      throw new UnexpectedValueError(
        `a non-nil "${Scalars.UnsignedInt}"`,
        maybeValue,
        { path },
      );
    }

    return parseGraphQLScalarValue(Scalars.UnsignedInt, maybeValue, path)!;
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
    };
  }
}
