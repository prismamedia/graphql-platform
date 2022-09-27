import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ReverseEdgeUnique } from '../../../../../definition/reverse-edge/unique.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export class ReverseEdgeUniqueHeadSelection
  implements SelectionExpressionInterface
{
  public readonly name: string;
  public readonly key: string;

  public constructor(
    public readonly reverseEdge: ReverseEdgeUnique,
    public readonly headSelection: NodeSelection,
  ) {
    this.name = reverseEdge.name;
    this.key = this.name;

    assert.equal(reverseEdge.head, headSelection.node);
  }

  public isAkinTo(
    expression: unknown,
  ): expression is ReverseEdgeUniqueHeadSelection {
    return (
      expression instanceof ReverseEdgeUniqueHeadSelection &&
      expression.reverseEdge === this.reverseEdge
    );
  }

  public equals(
    expression: unknown,
  ): expression is ReverseEdgeUniqueHeadSelection {
    return (
      this.isAkinTo(expression) &&
      expression.headSelection.equals(this.headSelection)
    );
  }

  public includes(expression: unknown): boolean {
    return (
      this.isAkinTo(expression) &&
      this.headSelection.includes(expression.headSelection)
    );
  }

  public mergeWith(
    expression: ReverseEdgeUniqueHeadSelection,
    path?: utils.Path,
  ): ReverseEdgeUniqueHeadSelection {
    assert(this.isAkinTo(expression));

    return new ReverseEdgeUniqueHeadSelection(
      this.reverseEdge,
      this.headSelection.mergeWith(expression.headSelection, path),
    );
  }

  public parseValue(
    maybeValue: unknown,
    path: utils.Path,
  ): null | NodeSelectedValue {
    if (maybeValue === undefined) {
      throw new utils.UnexpectedValueError(
        `a non-undefined "${this.reverseEdge.head}"`,
        maybeValue,
        { path },
      );
    }

    return maybeValue === null
      ? null
      : this.headSelection.parseValue(maybeValue, path);
  }

  @Memoize()
  public toGraphQLField(): graphql.FieldNode {
    return {
      kind: graphql.Kind.FIELD,
      name: {
        kind: graphql.Kind.NAME,
        value: this.name,
      },
      selectionSet: this.headSelection.toGraphQLSelectionSet(),
    };
  }
}
