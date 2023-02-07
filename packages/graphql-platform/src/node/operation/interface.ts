import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { Node } from '../../node.js';

export interface OperationInterface<TRequestContext extends object = any> {
  readonly node: Node;
  readonly operationType: graphql.OperationTypeNode;
  readonly name: utils.Name;
  isEnabled(): boolean;
  isPublic(): boolean;
  getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    any
  >;
  validate(): void;
  execute(
    args: utils.Nillable<utils.PlainObject>,
    context: TRequestContext,
    path?: utils.Path,
  ): Promise<any>;
}
