import * as utils from '@prismamedia/graphql-platform-utils';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import type { Operation } from '../operation.js';
import { OperationContext } from './context.js';

export type NodeAPI<TRequestContext extends object> = {
  [TOperation in Operation<TRequestContext> as TOperation['method']]: TOperation['execute'];
};

export const createNodeAPI = <TRequestContext extends object>(
  node: Node<TRequestContext>,
): NodeAPI<TRequestContext> =>
  new Proxy<any>(Object.create(null), {
    get: (_, method: Operation['method']) => {
      const operation = node.getOperationByMethod(method);

      return operation.execute.bind(operation);
    },
  });

export type ContextBoundNodeAPI = {
  [TOperation in Operation as TOperation['method']]: (
    args: Parameters<TOperation['execute']>[1],
    path?: Parameters<TOperation['execute']>[2],
  ) => ReturnType<TOperation['execute']>;
};

export const createContextBoundNodeAPI = <TRequestContext extends object>(
  node: Node<TRequestContext>,
  context: OperationContext<TRequestContext> | utils.Thunkable<TRequestContext>,
): ContextBoundNodeAPI =>
  new Proxy<any>(Object.create(null), {
    get: (_, method: Operation['method']) => {
      const operation = node.getOperationByMethod(method);

      return (operation.execute as any).bind(
        operation,
        context instanceof OperationContext
          ? context
          : utils.resolveThunkable(context),
      );
    },
  });

export type API<TRequestContext extends object> = Record<
  Node['name'],
  NodeAPI<TRequestContext>
>;

export const createAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
): API<TRequestContext> =>
  new Proxy<any>(Object.create(null), {
    get: (_, nodeName: Node['name']) => gp.getNodeByName(nodeName).api,
  });

export type ContextBoundAPI = Record<Node['name'], ContextBoundNodeAPI>;

export const createContextBoundAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
  context: utils.Thunkable<TRequestContext> | OperationContext<TRequestContext>,
): ContextBoundAPI =>
  new Proxy<any>(Object.create(null), {
    get: (_, nodeName: Node['name']) =>
      gp.getNodeByName(nodeName).createContextBoundAPI(context),
  });
