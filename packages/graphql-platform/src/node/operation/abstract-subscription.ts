import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { IterableElement } from 'type-fest';
import type { BrokerInterface } from '../../broker-interface.js';
import type { ConnectorInterface } from '../../connector-interface.js';
import { AbstractOperation } from '../abstract-operation.js';
import { OperationContext } from './context.js';

export interface SubscriptionConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> {
  /**
   * Optional, either the subscription is enabled or not
   *
   * @default true
   */
  enabled?: utils.OptionalFlag;

  /**
   * Optional, either the subscription is exposed publicly (= in the GraphQL API) or not
   *
   * @default false
   */
  public?: utils.OptionalFlag;
}

export abstract class AbstractSubscription<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult extends AsyncIterable<any>,
> extends AbstractOperation<
  TRequestContext,
  OperationContext<TRequestContext>,
  TArgs,
  TResult
> {
  public readonly operationType = graphql.OperationTypeNode.SUBSCRIPTION;

  @Memoize()
  public override isEnabled(): boolean {
    return super.isEnabled() && this.gp.subscriptionConfig.enabled;
  }

  @Memoize()
  public override isPublic(): boolean {
    return super.isPublic() && this.gp.subscriptionConfig.public;
  }

  public execute(
    context: TRequestContext | OperationContext<TRequestContext>,
    args: TArgs,
    path: utils.Path = utils.addPath(
      utils.addPath(undefined, this.operationType),
      this.name,
    ),
  ): TResult {
    this.assertIsEnabled(path);

    let operationContext: OperationContext;

    if (context instanceof OperationContext) {
      operationContext = context;
    } else {
      this.gp.assertRequestContext(context, path);

      operationContext = new OperationContext(this.gp, context);
    }

    const authorization = this.ensureAuthorization(operationContext, path);

    return this.internal(operationContext, authorization, args, path);
  }

  protected getGraphQLFieldConfigSubscriber(): NonNullable<
    graphql.GraphQLFieldConfig<
      undefined,
      TRequestContext,
      Omit<TArgs, 'selection'>
    >['subscribe']
  > {
    return async (_, args, context, info) => {
      try {
        return await this.execute(
          context,
          (this.selectionAware ? { ...args, selection: info } : args) as TArgs,
          info.path,
        );
      } catch (error) {
        throw error instanceof utils.GraphError
          ? error.toGraphQLError()
          : error;
      }
    };
  }

  protected getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    IterableElement<TResult>,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'] {
    return undefined;
  }
}
