import {
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { Component } from '../../../../definition/component.js';
import type { Leaf, LeafValue } from '../../../../definition/component/leaf.js';
import type { SelectionExpressionInterface } from '../../expression-interface.js';

export class LeafSelection implements SelectionExpressionInterface {
  public readonly component: Component;
  public readonly name: string;
  public readonly key: string;

  public constructor(public readonly leaf: Leaf) {
    this.component = leaf;
    this.name = leaf.name;
    this.key = this.name;
  }

  public isAkinTo(expression: unknown): expression is LeafSelection {
    return expression instanceof LeafSelection && expression.leaf === this.leaf;
  }

  public equals(expression: unknown): expression is LeafSelection {
    return this.isAkinTo(expression);
  }

  public includes(expression: unknown): boolean {
    return this.isAkinTo(expression);
  }

  public mergeWith(expression: LeafSelection, path?: Path): this {
    if (!this.isAkinTo(expression)) {
      throw new UnexpectedValueError(
        `${this.leaf.indefinite}'s selection`,
        expression,
        { path },
      );
    }

    return this;
  }

  public parseValue(maybeValue: unknown, path: Path): LeafValue {
    return this.leaf.parseValue(maybeValue, path);
  }

  public toGraphQLField(): graphql.FieldNode {
    return {
      kind: graphql.Kind.FIELD,
      name: {
        kind: graphql.Kind.NAME,
        value: this.name,
      },
    };
  }
}
