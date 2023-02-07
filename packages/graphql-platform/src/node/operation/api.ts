import * as utils from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { GraphQLPlatform } from '../../index.js';
import { OperationContext } from './context.js';
import type { OperationInterface } from './interface.js';
import type { MutationInterface } from './mutation/interface.js';

export interface API<TRequestContext extends object> {
  readonly [graphql.OperationTypeNode.MUTATION]: Readonly<
    Record<
      MutationInterface['name'],
      MutationInterface<TRequestContext>['execute']
    >
  >;
  readonly [graphql.OperationTypeNode.QUERY]: Readonly<
    Record<
      OperationInterface['name'],
      OperationInterface<TRequestContext>['execute']
    >
  >;
  readonly [graphql.OperationTypeNode.SUBSCRIPTION]: Readonly<
    Record<
      OperationInterface['name'],
      OperationInterface<TRequestContext>['execute']
    >
  >;
}

export const createAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
): API<TRequestContext> =>
  Object.fromEntries(
    utils.operationTypes.map((type) => [
      type,
      new Proxy<any>(Object.create(null), {
        get:
          (_, name: OperationInterface['name']) =>
          (
            ...[args, context, path]: Parameters<
              OperationInterface<TRequestContext>['execute']
            >
          ) =>
            gp
              .getOperationByTypeAndName(type, name)
              .execute(args, context, path),
      }),
    ]),
  ) as any;

export type ContextBoundAPI<TRequestContext extends object> = Readonly<
  Record<
    graphql.OperationTypeNode,
    Readonly<
      Record<
        OperationInterface['name'],
        (
          args: Parameters<OperationInterface<TRequestContext>['execute']>[0],
        ) => ReturnType<OperationInterface<TRequestContext>['execute']>
      >
    >
  >
>;

export const createContextBoundAPI = <TRequestContext extends object>(
  gp: GraphQLPlatform<TRequestContext>,
  context: OperationContext<TRequestContext>,
): ContextBoundAPI<TRequestContext> =>
  Object.fromEntries(
    utils.operationTypes.map((type) => [
      type,
      new Proxy<any>(Object.create(null), {
        get:
          (_, name: OperationInterface['name']) =>
          (
            args: Parameters<OperationInterface<TRequestContext>['execute']>[0],
          ) =>
            gp.getOperationByTypeAndName(type, name).execute(args, context),
      }),
    ]),
  ) as any;
