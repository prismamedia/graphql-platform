import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ReverseEdgeMultiple } from '../../../../../definition/reverse-edge/multiple.js';
import { areFiltersEqual, NodeFilter } from '../../../../filter.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export type ReverseEdgeMultipleCountSelectionArgs = utils.Nillable<{
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
    _path?: utils.Path,
  ): this {
    assert(this.isAkinTo(expression));

    return this;
  }

  public parseValue(maybeValue: unknown, path: utils.Path): number {
    if (maybeValue == null) {
      throw new utils.UnexpectedValueError(
        `a non-nil "${scalars.typesByName.UnsignedInt}"`,
        maybeValue,
        { path },
      );
    }

    return utils.parseGraphQLScalarValue(
      scalars.typesByName.UnsignedInt,
      maybeValue,
      path,
    )!;
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