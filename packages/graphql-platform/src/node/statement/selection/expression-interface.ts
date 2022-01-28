import type { Name, Path } from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';

export interface SelectionExpressionInterface {
  readonly alias?: Name;
  readonly name: Name;
  readonly key: Name;
  isAkinTo(expression: unknown): boolean;
  equals(expression: unknown): boolean;
  includes(expression: unknown): boolean;
  toGraphQLField(): graphql.FieldNode;
  parseValue(maybeValue: unknown, path: Path): any;
}
