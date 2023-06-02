import type * as utils from '@prismamedia/graphql-platform-utils';
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
}
