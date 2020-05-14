import {
  GraphQLFieldConfig as GraphQLFieldConfigBase,
  GraphQLResolveInfo,
} from 'graphql';
import { MaybePromise } from '../maybe-promise';

export type FieldResolverArgs<TSource = any, TContext = any, TArgs = any> = [
  TSource,
  TArgs,
  TContext,
  GraphQLResolveInfo,
];

/** Override the original "GraphQLFieldResolver" to be able to define the result */
export type FieldResolver<
  TSource = any,
  TContext = any,
  TArgs = any,
  TResult = any
> = (
  ...args: FieldResolverArgs<TSource, TContext, TArgs>
) => MaybePromise<TResult>;

/** Override the original "GraphQLFieldConfig" to be able to define the resolver's result */
export interface FieldConfig<
  TSource = any,
  TContext = any,
  TArgs = any,
  TResult = any
> extends Omit<GraphQLFieldConfigBase<TSource, TContext, TArgs>, 'resolve'> {
  resolve?: FieldResolver<TSource, TContext, TArgs, TResult>;
}

export interface FieldConfigMap<TSource = any, TContext = any, TArgs = any> {
  [key: string]: FieldConfig<TSource, TContext, TArgs>;
}
