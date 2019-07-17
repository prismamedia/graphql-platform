import { MaybePromise, POJO } from '@prismamedia/graphql-platform-utils';
import { AnyBaseContext, BaseContext } from '../graphql-platform';
import {
  CountOperationArgs,
  CountOperationResult,
  FindManyOperationArgs,
  FindManyOperationResult,
  OperationResolverParams,
} from './operation';
import { Resource } from './resource';
import { NormalizedComponentValue } from './resource/component';
import { WhereInputValue, WhereUniqueInputValue } from './type';
import { NodeSource } from './type/output';

export type ConnectorOperationParams<
  TArgs extends POJO = any,
  TBaseContext extends AnyBaseContext = BaseContext
> = OperationResolverParams<TArgs, {}, TBaseContext> & Readonly<{ resource: Resource }>;

export interface ConnectorCreateInputValue {
  [componentName: string]: NormalizedComponentValue;
}

export interface ConnectorUpdateInputValue {
  [componentName: string]: NormalizedComponentValue;
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
