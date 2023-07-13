import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { JsonValue } from 'type-fest';
import type { DependencyGraph } from '../../subscription.js';

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
  toGraphQLField(): graphql.FieldNode;

  parseValue(maybeValue: unknown, path?: utils.Path): TInternal;
  areValuesEqual(a: TInternal, b: TInternal): boolean;
  uniqValues?(values: ReadonlyArray<TInternal>): TInternal[];
  serialize(maybeValue: unknown, path?: utils.Path): TExternal;
  stringify(maybeValue: unknown, path?: utils.Path): string;

  /**
   * Returns the dependency graph of this expression, if any
   */
  readonly dependencies?: DependencyGraph;
}
