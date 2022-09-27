import type * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type { OperationContext } from './context.js';

export interface OperationInterface<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  readonly node: Node<TRequestContext, TConnector>;
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
    context: TRequestContext | OperationContext<TRequestContext, TConnector>,
    path?: utils.Path,
  ): Promise<any>;
}
