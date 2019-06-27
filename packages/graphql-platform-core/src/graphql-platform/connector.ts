import { MaybePromise, POJO, Scalar } from '@prismamedia/graphql-platform-utils';
import { BaseContext } from '../graphql-platform';
import {
  CountOperationArgs,
  CountOperationResult,
  FindManyOperationArgs,
  FindManyOperationResult,
  OperationContext,
  OperationResolverParams,
} from './operation';
import { NodeValue, Resource } from './resource';
import { WhereInputValue, WhereUniqueInputValue } from './type';
import { NodeSource } from './type/output';

export type ConnectorOperationParams<
  TArgs extends POJO = any,
  TBaseContext extends BaseContext = any,
  TOperationContext extends OperationContext = any
> = OperationResolverParams<TArgs, {}, TBaseContext, TOperationContext> & Readonly<{ resource: Resource }>;

export interface ConnectorCreateInputValue extends NodeValue {
  [componentName: string]: null | Scalar | WhereUniqueInputValue;
}

export interface ConnectorUpdateInputValue extends NodeValue {
  [componentName: string]: null | Scalar | WhereUniqueInputValue;
}

export type ConnectorFindOperationArgs = FindManyOperationArgs;

export type ConnectorFindOperationResult = FindManyOperationResult;

export type ConnectorCountOperationArgs = CountOperationArgs;

export type ConnectorCountOperationResult = CountOperationResult;

export interface ConnectorCreateOperationArgs {
  data: ConnectorCreateInputValue[];
}

export type ConnectorCreateOperationResult = (WhereUniqueInputValue & NodeSource)[];

export interface ConnectorUpdateOperationArgs {
  where: WhereInputValue;
  data: ConnectorUpdateInputValue;
}

export type ConnectorUpdateOperationResult = {
  matchedCount: number;
  changedCount: number;
};

export interface ConnectorDeleteOperationArgs {
  where: WhereInputValue;
}

export type ConnectorDeleteOperationResult = number;

export interface ConnectorInterface<
  TBaseContext extends BaseContext = BaseContext,
  TOperationContext extends OperationContext = OperationContext
> {
  find(
    params: ConnectorOperationParams<ConnectorFindOperationArgs, TBaseContext, TOperationContext>,
  ): MaybePromise<ConnectorFindOperationResult>;

  count(
    params: ConnectorOperationParams<ConnectorCountOperationArgs, TBaseContext, TOperationContext>,
  ): MaybePromise<ConnectorCountOperationResult>;

  create(
    params: ConnectorOperationParams<ConnectorCreateOperationArgs, TBaseContext, TOperationContext>,
  ): MaybePromise<ConnectorCreateOperationResult>;

  update(
    params: ConnectorOperationParams<ConnectorUpdateOperationArgs, TBaseContext, TOperationContext>,
  ): MaybePromise<ConnectorUpdateOperationResult>;

  delete(
    params: ConnectorOperationParams<ConnectorDeleteOperationArgs, TBaseContext, TOperationContext>,
  ): MaybePromise<ConnectorDeleteOperationResult>;
}
