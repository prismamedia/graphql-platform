import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';

export interface SelectionExpressionInterface {
  readonly alias?: utils.Name;
  readonly name: utils.Name;
  readonly key: utils.Name;
  isAkinTo(expression: unknown): boolean;
  equals(expression: unknown): boolean;
  includes(expression: unknown): boolean;
  toGraphQLField(): graphql.FieldNode;
  parseValue(maybeValue: unknown, path: utils.Path): any;
}
