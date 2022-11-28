import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../connector-interface.js';
import { AbstractOperation } from '../abstract-operation.js';
import { ConnectorError, InternalError } from './error.js';

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
      subscribe: async (_, args, context, info) => {
        try {
          return await this.execute(
            (this.selectionAware
              ? { ...args, selection: info }
              : args) as TArgs,
            context,
            info.path,
          );
        } catch (error) {
          throw utils.isConfigError(error) || error instanceof ConnectorError
            ? new InternalError({ path: info.path, cause: error })
            : error;
        }
      },
    };
  }
}
