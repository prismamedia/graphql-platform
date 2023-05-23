import * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { GraphQLPlatform } from '../../index.js';
import { OperationContext } from './context.js';
import type { OperationInterface } from './interface.js';

export type API<TRequestContext extends object> = Record<
  graphql.OperationTypeNode,
  Record<
    OperationInterface['name'],
    OperationInterface<TRequestContext>['execute']
  >
>;

export const createAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
): API<TRequestContext> =>
  Object.fromEntries(
    utils.operationTypes.map((type) => [
      type,
      new Proxy<any>(Object.create(null), {
        get:
          (_, name: OperationInterface['name']) =>
          (...args: Parameters<OperationInterface['execute']>) =>
            gp.getOperationByTypeAndName(type, name).execute(...args),
      }),
    ]),
  ) as any;

export type ContextBoundAPI = Record<
  graphql.OperationTypeNode,
  Record<
    OperationInterface['name'],
    (
      args: Parameters<OperationInterface['execute']>[1],
      path?: Parameters<OperationInterface['execute']>[2],
    ) => ReturnType<OperationInterface['execute']>
  >
>;

export const createContextBoundAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
  context: OperationContext<TRequestContext>,
): ContextBoundAPI =>
  Object.fromEntries(
    utils.operationTypes.map((type) => [
      type,
      new Proxy<any>(Object.create(null), {
        get:
          (_, name: OperationInterface['name']) =>
          (
            args: Parameters<OperationInterface['execute']>[1],
            path?: Parameters<OperationInterface['execute']>[2],
          ) =>
            gp
              .getOperationByTypeAndName(type, name)
              .execute(context, args, path),
      }),
    ]),
  ) as any;
