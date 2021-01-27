import { PlainObject } from '@prismamedia/graphql-platform-utils';
import { ConnectorInterface } from '../../../connector';
import { AbstractOperation } from '../abstract';

export abstract class AbstractQuery<
  TRequestContext,
  TConnector extends ConnectorInterface,
  TArgs extends PlainObject | undefined,
  TResult,
> extends AbstractOperation<TRequestContext, TConnector, TArgs, TResult> {
  public readonly type = 'query';
}
