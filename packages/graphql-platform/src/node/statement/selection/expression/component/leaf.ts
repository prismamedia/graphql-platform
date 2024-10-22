import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { NodeValue } from '../../../../../node.js';
import type { NodeChange, NodeUpdate } from '../../../../change.js';
import type { Component, Leaf, LeafValue } from '../../../../definition.js';
import type { OperationContext } from '../../../../operation.js';
import { type BooleanFilter } from '../../../filter.js';
import type { SelectionExpressionInterface } from '../../expression-interface.js';

export class LeafSelection<TSource extends LeafValue = any, TValue = TSource>
  implements SelectionExpressionInterface<TSource, TValue>
{
  public readonly component: Component;
  public readonly name: string;
  public readonly key: string;

  public constructor(
    public readonly leaf: Leaf,
    public readonly alias: string | undefined,
  ) {
    this.component = leaf;
    this.name = leaf.name;
    this.key = this.alias ?? this.name;
  }

  public get hasVirtualSelection(): boolean {
    return false;
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

  public isAffectedByRootUpdate(update: NodeUpdate): boolean {
    return update.hasComponentUpdate(this.leaf);
  }

  public getAffectedGraph(
    _change: NodeChange,
    _visitedRootNodes?: ReadonlyArray<NodeValue>,
  ): BooleanFilter | null {
    return null;
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
    };
  }

  public parseSource(
    maybeValue: unknown,
    path: utils.Path = utils.addPath(undefined, this.leaf.toString()),
  ): TSource {
    return this.leaf.parseValue(maybeValue, path) as any;
  }

  public resolveValue(
    source: TSource,
    _context: OperationContext,
    _path?: utils.Path,
  ): TValue {
    return source as any;
  }

  public pickValue(superSetOfValue: TValue, _path: utils.Path): TValue {
    return superSetOfValue;
  }

  public areValuesEqual(a: TValue, b: TValue): boolean {
    return this.leaf.areValuesEqual(a as any, b as any);
  }
}
