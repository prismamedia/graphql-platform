import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { JsonValue } from 'type-fest';
import type { NodeValue } from '../../../node.js';
import type { NodeChange, NodeUpdate } from '../../change.js';
import type { BooleanFilter } from '../filter.js';

export interface SelectionExpressionInterface<
  TInternal = any,
  TExternal extends JsonValue = any,
> {
  readonly alias?: utils.Name;
  readonly name: utils.Name;
  readonly key: utils.Name;

  isAkinTo(expression: unknown): boolean;

  equals(expression: unknown): boolean;

  isSupersetOf(expression: unknown): boolean;

  /**
   * Is the provided update affecting this expression?
   */
  isAffectedByNodeUpdate(update: NodeUpdate): boolean;

  getAffectedGraphByNodeChange(
    change: NodeChange,
    visitedRootNodes?: NodeValue[],
  ): BooleanFilter;

  toGraphQLFieldNode(): graphql.FieldNode;

  parseValue(maybeValue: unknown, path?: utils.Path): TInternal;
  areValuesEqual(a: TInternal, b: TInternal): boolean;
  uniqValues?(values: ReadonlyArray<TInternal>): TInternal[];
  serialize(maybeValue: unknown, path?: utils.Path): TExternal;
  stringify(maybeValue: unknown, path?: utils.Path): string;
}
