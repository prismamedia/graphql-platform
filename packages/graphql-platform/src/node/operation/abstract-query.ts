import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { CamelCase } from 'type-fest';
import { AbstractOperation } from '../abstract-operation.js';

export abstract class AbstractQuery<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> extends AbstractOperation<TRequestContext, TArgs, TResult> {
  public readonly operationType = graphql.OperationTypeNode.QUERY;

  @Memoize()
  public get method(): CamelCase<this['key']> {
    return this.key.replaceAll(/((?:-).)/g, ([_match, letter]) =>
      letter.toUpperCase(),
    ) as any;
  }

  protected getGraphQLFieldConfigSubscriber(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['subscribe'] {
    return undefined;
  }

  protected getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'] {
    return (_, args, context, info) =>
      this.execute(
        context,
        (this.selectionAware ? { ...args, selection: info } : args) as TArgs,
        info.path,
      ).catch((error) => {
        throw error instanceof utils.GraphError
          ? error.toGraphQLError()
          : error;
      });
  }
}
