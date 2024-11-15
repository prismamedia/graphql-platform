import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { Promisable } from 'type-fest';
import type { Dependency } from '../../change.js';
import type { OperationContext } from '../../operation.js';

export interface SelectionExpressionInterface<TSource = any, TValue = TSource> {
  readonly alias?: utils.Name;
  readonly name: utils.Name;
  readonly key: utils.Name;
  readonly ast: graphql.FieldNode;

  readonly hasVirtualSelection: boolean;

  isAkinTo(expression: unknown): boolean;

  equals(expression: unknown): boolean;

  isSupersetOf(expression: unknown): boolean;

  dependency?: Dependency;

  parseSource(maybeSource: unknown, path?: utils.Path): TSource;

  resolveValue(
    source: TSource,
    context: OperationContext,
    path?: utils.Path,
  ): Promisable<TValue>;

  pickValue(superSetOfValue: TValue, path?: utils.Path): TValue;

  areValuesEqual(a: TValue, b: TValue): boolean;
}
