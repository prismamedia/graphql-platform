import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import type { IterableElement, Promisable } from 'type-fest';
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
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult extends Promisable<AsyncIterable<any>> = any,
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> extends AbstractOperation<
  TArgs,
  TResult,
  TRequestContext,
  TConnector,
  TBroker,
  TContainer,
  OperationContext<TRequestContext, TConnector, TBroker, TContainer>
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

  public override execute(
    requestOrOperationContext: TRequestContext | OperationContext,
    args: TArgs,
    path?: utils.Path,
  ): TResult {
    let context: OperationContext;

    if (requestOrOperationContext instanceof OperationContext) {
      assert.strictEqual(requestOrOperationContext.gp, this.gp);

      context = requestOrOperationContext;
    } else {
      this.gp.assertRequestContext(requestOrOperationContext, path);

      context = new OperationContext(this.gp, requestOrOperationContext);
    }

    return super.execute(context, args, path);
  }

  protected getGraphQLFieldConfigSubscriber(): NonNullable<
    graphql.GraphQLFieldConfig<
      undefined,
      TRequestContext,
      Omit<TArgs, 'selection'>
    >['subscribe']
  > {
    return (_, args, context, info) =>
      new Promise((resolve) =>
        resolve(
          this.execute(
            context,
            (this.selectionAware
              ? { ...args, selection: info }
              : args) as TArgs,
            info.path,
          ),
        ),
      ).catch((error) => {
        throw error instanceof utils.GraphError
          ? error.toGraphQLError()
          : error;
      });
  }

  protected getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    IterableElement<TResult>,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'] {
    return undefined;
  }
}
