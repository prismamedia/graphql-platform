import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { Component } from '../../../../../definition/component.js';
import type { Edge } from '../../../../../definition/component/edge.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from '../../../../selection.js';
import type { SelectionExpressionInterface } from '../../../expression-interface.js';

export class EdgeHeadSelection implements SelectionExpressionInterface {
  public readonly component: Component;
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;

  public constructor(
    public readonly edge: Edge,
    alias: string | undefined,
    public readonly headSelection: NodeSelection,
  ) {
    this.component = edge;
    this.alias = alias || undefined;
    this.name = edge.name;
    this.key = this.alias ?? this.name;

    assert.equal(edge.head, headSelection.node);
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

  public includes(expression: unknown): boolean {
    return (
      this.isAkinTo(expression) &&
      this.headSelection.includes(expression.headSelection)
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

  public parseValue(
    maybeValue: unknown,
    path: utils.Path,
  ): null | NodeSelectedValue {
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

      return null;
    }

    return this.headSelection.parseValue(maybeValue, path);
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
