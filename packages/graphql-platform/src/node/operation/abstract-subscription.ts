import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { IterableElement, PascalCase } from 'type-fest';
import type { BrokerInterface } from '../../broker-interface.js';
import type { ConnectorInterface } from '../../connector-interface.js';
import { AbstractOperation } from '../abstract-operation.js';

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
> extends AbstractOperation<TRequestContext, TArgs, TResult> {
  public readonly operationType = graphql.OperationTypeNode.SUBSCRIPTION;

  @Memoize()
  public override isEnabled(): boolean {
    return super.isEnabled() && this.gp.subscriptionConfig.enabled;
  }

  @Memoize()
  public override isPublic(): boolean {
    return super.isPublic() && this.gp.subscriptionConfig.public;
  }

  /**
   * This is unique for a node
   *
   * It identifies the operation for a given node
   */
  @Memoize()
  public get method(): `subscribeTo${PascalCase<this['key']>}` {
    return `subscribeTo${this.key.replaceAll(/((?:^|-).)/g, (_match, letter) =>
      letter.toUpperCase(),
    )}` as any;
  }

  protected getGraphQLFieldConfigSubscriber(): NonNullable<
    graphql.GraphQLFieldConfig<
      undefined,
      TRequestContext,
      Omit<TArgs, 'selection'>
    >['subscribe']
  > {
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

  protected getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    IterableElement<TResult>,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'] {
    return undefined;
  }
}
