import {
  type Nillable,
  type PlainObject,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../connector-interface.js';
import { AbstractOperation } from '../abstract-operation.js';

export abstract class AbstractQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TArgs extends Nillable<PlainObject>,
  TResult,
> extends AbstractOperation<TRequestContext, TConnector, TArgs, TResult> {
  public override readonly operationType = graphql.OperationTypeNode.QUERY;
}
