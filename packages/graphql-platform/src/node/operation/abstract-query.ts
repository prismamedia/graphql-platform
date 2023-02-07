import type * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { AbstractOperation } from '../abstract-operation.js';

export abstract class AbstractQuery<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> extends AbstractOperation<TRequestContext, TArgs, TResult> {
  public override readonly operationType = graphql.OperationTypeNode.QUERY;
}
