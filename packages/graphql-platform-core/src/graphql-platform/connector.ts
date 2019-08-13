import { GraphQLSelectionNode, MaybePromise, POJO } from '@prismamedia/graphql-platform-utils';
import { AnyBaseContext, BaseContext, Context } from '../graphql-platform';
import {
  CountOperationArgs,
  CountOperationResult,
  CreateOneValue,
  FindManyOperationArgs,
  FindManyOperationResult,
  UpdateOneValue,
} from './operation';
import { Resource } from './resource';
import { WhereInputValue } from './type';

export type ConnectorOperationParams<
  TArgs extends POJO = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = Readonly<{
  args: TArgs;
  context: Context<{}, TBaseContext>;
  selectionNode: GraphQLSelectionNode<any>;
  resource: Resource;
}>;

export type ConnectorFindOperationArgs = FindManyOperationArgs;

export type ConnectorFindOperationResult = FindManyOperationResult;

export type ConnectorCountOperationArgs = CountOperationArgs;

export type ConnectorCountOperationResult = CountOperationResult;

export interface ConnectorCreateOperationArgs {
  data: CreateOneValue[];
}

export type ConnectorCreateOperationResult = CreateOneValue[];

export interface ConnectorUpdateOperationArgs {
  where: WhereInputValue;
  data: UpdateOneValue;
}

export type ConnectorUpdateOperationResult = {
  matchedCount: number;
  changedCount: number;
};

export interface ConnectorDeleteOperationArgs {
  where: WhereInputValue;
}

export type ConnectorDeleteOperationResult = number;

export interface ConnectorInterface<TBaseContext extends AnyBaseContext = BaseContext> {
  find(
    params: ConnectorOperationParams<ConnectorFindOperationArgs, TBaseContext>,
  ): MaybePromise<ConnectorFindOperationResult>;

  count(
    params: ConnectorOperationParams<ConnectorCountOperationArgs, TBaseContext>,
  ): MaybePromise<ConnectorCountOperationResult>;

  create(
    params: ConnectorOperationParams<ConnectorCreateOperationArgs, TBaseContext>,
  ): MaybePromise<ConnectorCreateOperationResult>;

  update(
    params: ConnectorOperationParams<ConnectorUpdateOperationArgs, TBaseContext>,
  ): MaybePromise<ConnectorUpdateOperationResult>;

  delete(
    params: ConnectorOperationParams<ConnectorDeleteOperationArgs, TBaseContext>,
  ): MaybePromise<ConnectorDeleteOperationResult>;
}
