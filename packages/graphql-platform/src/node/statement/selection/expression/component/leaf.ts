import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { Component } from '../../../../definition/component.js';
import type { Leaf, LeafValue } from '../../../../definition/component/leaf.js';
import type { SelectionExpressionInterface } from '../../expression-interface.js';

export class LeafSelection implements SelectionExpressionInterface {
  public readonly component: Component;
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;

  public constructor(public readonly leaf: Leaf, alias: string | undefined) {
    this.component = leaf;
    this.alias = alias || undefined;
    this.name = leaf.name;
    this.key = this.alias ?? this.name;
  }

  public isAkinTo(expression: unknown): expression is LeafSelection {
    return (
      expression instanceof LeafSelection &&
      expression.leaf === this.leaf &&
      expression.alias === this.alias
    );
  }

  public equals(expression: unknown): expression is LeafSelection {
    return this.isAkinTo(expression);
  }

  public includes(expression: unknown): boolean {
    return this.isAkinTo(expression);
  }

  public mergeWith(expression: LeafSelection, _path?: utils.Path): this {
    assert(this.isAkinTo(expression));

    return this;
  }

  public parseValue(maybeValue: unknown, path: utils.Path): LeafValue {
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
