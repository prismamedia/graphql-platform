import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { JsonValue } from 'type-fest';
import type { Component, Leaf, LeafValue } from '../../../../definition.js';
import { DependencyGraph } from '../../../../operation/dependency-graph.js';
import type { SelectionExpressionInterface } from '../../expression-interface.js';

export class LeafSelection implements SelectionExpressionInterface<LeafValue> {
  public readonly component: Component;
  public readonly alias?: string;
  public readonly name: string;
  public readonly key: string;

  public readonly dependencies: DependencyGraph;

  public constructor(public readonly leaf: Leaf, alias: string | undefined) {
    this.component = leaf;
    this.alias = alias || undefined;
    this.name = leaf.name;
    this.key = this.alias ?? this.name;

    this.dependencies = DependencyGraph.fromLeaf(leaf);
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

  public isSupersetOf(expression: unknown): boolean {
    return this.isAkinTo(expression);
  }

  public mergeWith(expression: LeafSelection, _path?: utils.Path): this {
    assert(this.isAkinTo(expression));

    return this;
  }

  public toGraphQLFieldNode(): graphql.FieldNode {
    return {
      kind: graphql.Kind.FIELD,
      name: {
        kind: graphql.Kind.NAME,
        value: this.name,
      },
    };
  }

  public parseValue(maybeValue: unknown, path?: utils.Path): LeafValue {
    return this.leaf.parseValue(maybeValue, path);
  }

  public areValuesEqual(a: LeafValue, b: LeafValue): boolean {
    return this.leaf.areValuesEqual(a, b);
  }

  public uniqValues(values: ReadonlyArray<LeafValue>): LeafValue[] {
    return this.leaf.uniqValues(values);
  }

  public serialize(maybeValue: unknown, path?: utils.Path): JsonValue {
    return this.leaf.serialize(maybeValue, path);
  }

  public stringify(maybeValue: unknown, path?: utils.Path): string {
    return this.leaf.stringify(maybeValue, path);
  }
}
