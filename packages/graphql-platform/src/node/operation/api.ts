import * as utils from '@prismamedia/graphql-platform-utils';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import type { Operation, OperationType } from '../operation.js';
import { OperationContext } from './context.js';
import type { OperationInterface } from './interface.js';

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

export type API<TRequestContext extends object> = {
  [TType in OperationType]: Record<
    OperationInterface['name'],
    OperationInterface<TRequestContext>['execute']
  >;
} & {
  [TNode: Node['name']]: NodeAPI<TRequestContext>;
};

export const createAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
): API<TRequestContext> =>
  new Proxy<any>(Object.create(null), {
    get: (_, operationTypeOrNodeName: OperationType | Node['name']) =>
      utils.operationTypeSet.has(operationTypeOrNodeName as any)
        ? new Proxy<any>(Object.create(null), {
            get: (_, name: OperationInterface['name']) => {
              const operation = gp.getOperationByTypeAndName(
                operationTypeOrNodeName as any,
                name as any,
              );

              return operation.execute.bind(operation);
            },
          })
        : gp.getNodeByName(operationTypeOrNodeName).api,
  });

export type ContextBoundAPI = {
  [TType in OperationType]: Record<
    OperationInterface['name'],
    (
      args: Parameters<OperationInterface['execute']>[1],
      path?: Parameters<OperationInterface['execute']>[2],
    ) => ReturnType<OperationInterface['execute']>
  >;
} & {
  [TNode: Node['name']]: ContextBoundNodeAPI;
};

export const createContextBoundAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
  context: utils.Thunkable<TRequestContext> | OperationContext<TRequestContext>,
): ContextBoundAPI =>
  new Proxy<any>(Object.create(null), {
    get: (_, operationTypeOrNodeName: OperationType | Node['name']) =>
      utils.operationTypeSet.has(operationTypeOrNodeName as any)
        ? new Proxy<any>(Object.create(null), {
            get: (_, name: OperationInterface['name']) => {
              const operation = gp.getOperationByTypeAndName(
                operationTypeOrNodeName as any,
                name as any,
              );

              return operation.execute.bind(
                operation,
                utils.resolveThunkable(context),
              );
            },
          })
        : gp
            .getNodeByName(operationTypeOrNodeName)
            .createContextBoundAPI(context),
  });
