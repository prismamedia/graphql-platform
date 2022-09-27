import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../connector-interface.js';
import { AbstractOperation } from '../abstract-operation.js';

export abstract class AbstractSubscription<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult extends AsyncIterator<any>,
> extends AbstractOperation<TRequestContext, TConnector, TArgs, TResult> {
  public override readonly operationType =
    graphql.OperationTypeNode.SUBSCRIPTION;

  @Memoize()
  public override isEnabled(): boolean {
    return false;
  }

  public getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  > {
    assert(this.isPublic(), `The "${this}" ${this.operationType} is private`);

    return {
      ...(this.description && { description: this.description }),
      ...(this.node.deprecationReason && {
        deprecationReason: this.node.deprecationReason,
      }),
      ...(this.arguments.length && {
        args: utils.getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.getGraphQLOutputType(),
      subscribe: (_, args, context, info) =>
        this.execute(
          (this.selectionAware ? { ...args, selection: info } : args) as TArgs,
          context,
          info.path,
        ),
    };
  }
}
