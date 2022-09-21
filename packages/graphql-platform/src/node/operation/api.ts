import { operationTypes } from '@prismamedia/graphql-platform-utils';
import type * as graphql from 'graphql';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import { OperationContext } from './context.js';
import type { OperationInterface } from './interface.js';
import type { MutationInterface } from './mutation/interface.js';

export interface API<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  readonly [graphql.OperationTypeNode.MUTATION]: Readonly<
    Record<
      MutationInterface['name'],
      MutationInterface<TRequestContext, TConnector>['execute']
    >
  >;
  readonly [graphql.OperationTypeNode.QUERY]: Readonly<
    Record<
      OperationInterface['name'],
      OperationInterface<TRequestContext, TConnector>['execute']
    >
  >;
  readonly [graphql.OperationTypeNode.SUBSCRIPTION]: Readonly<
    Record<
      OperationInterface['name'],
      OperationInterface<TRequestContext, TConnector>['execute']
    >
  >;
}

export const createAPI = <
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
>(
  gp: GraphQLPlatform<TRequestContext, TConnector>,
): API<TRequestContext, TConnector> =>
  Object.fromEntries(
    operationTypes.map((type) => [
      type,
      new Proxy<any>(Object.create(null), {
        get:
          (_, name: OperationInterface['name']) =>
          (
            ...[args, context, path]: Parameters<
              OperationInterface<TRequestContext, TConnector>['execute']
            >
          ) =>
            gp
              .getOperationByTypeAndName(type, name)
              .execute(args, context, path),
      }),
    ]),
  ) as any;

export type ContextBoundAPI<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> = Readonly<
  Record<
    graphql.OperationTypeNode,
    Readonly<
      Record<
        OperationInterface['name'],
        (
          args: Parameters<
            OperationInterface<TRequestContext, TConnector>['execute']
          >[0],
        ) => ReturnType<
          OperationInterface<TRequestContext, TConnector>['execute']
        >
      >
    >
  >
>;

export const createContextBoundAPI = <
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
>(
  gp: GraphQLPlatform<TRequestContext, TConnector>,
  context: OperationContext<TRequestContext, TConnector>,
): ContextBoundAPI<TRequestContext, TConnector> =>
  Object.fromEntries(
    operationTypes.map((type) => [
      type,
      new Proxy<any>(Object.create(null), {
        get:
          (_, name: OperationInterface['name']) =>
          (
            args: Parameters<
              OperationInterface<TRequestContext, TConnector>['execute']
            >[0],
          ) =>
            gp.getOperationByTypeAndName(type, name).execute(args, context),
      }),
    ]),
  ) as any;
