import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except, Promisable } from 'type-fest';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeValue } from '../../../node.js';
import type { NodeUpdate } from '../../change.js';
import type { UniqueConstraintValue } from '../../definition.js';
import type { NodeUpdateValue } from '../../statement/update.js';
import type { NodeUpdateInputValue } from '../../type/input/update.js';
import {
  AbstractMutation,
  type AbstractMutationConfig,
  type AbstractMutationHookArgs,
} from '../abstract-mutation.js';

interface AbstractUpdateHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractMutationHookArgs<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {
  /**
   * The provided "data" argument
   */
  readonly data: Readonly<NonNullable<NodeUpdateInputValue>>;
}

export interface PreUpdateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractUpdateHookArgs<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {
  /**
   * The current node's id
   */
  readonly id: Readonly<UniqueConstraintValue>;

  /**
   * The current node's value
   */
  readonly current: Readonly<NodeValue>;

  /**
   * The update statement, as a mutable plain-object
   */
  readonly update: NodeUpdateValue;

  /**
   * The node's value as it would be if we apply the update: current + update = target
   */
  readonly target: NodeValue;
}

export interface PostUpdateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractUpdateHookArgs<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {
  /**
   * The uncommitted change
   */
  readonly change: NodeUpdate<TRequestContext>;
}

/**
 * Optional, fine-tune the "update"
 */
export interface UpdateConfig<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> extends AbstractMutationConfig<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {
  /**
   * Optional, add some "virtual" fields whose values can be used in the hooks
   */
  virtualFields?: Record<
    utils.InputConfig['name'],
    Except<utils.InputConfig, 'name'>
  >;

  /**
   * Optional, add some custom validation/logic over the "update" statement that is about to be sent to the connector,
   *
   * Throwing an Error here will prevent the update
   */
  preUpdate?(
    args: PreUpdateArgs<TRequestContext, TConnector, TBroker, TContainer>,
  ): Promisable<void>;

  /**
   * Optional, given the "change", add some custom logic before the result is returned
   *
   * Throwing an Error here will fail the update
   */
  postUpdate?(
    args: PostUpdateArgs<TRequestContext, TConnector, TBroker, TContainer>,
  ): Promisable<void>;
}

export abstract class AbstractUpdate<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = any,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  TBroker,
  TContainer,
  TArgs,
  TResult
> {
  public readonly mutationTypes = [utils.MutationType.UPDATE];
}
