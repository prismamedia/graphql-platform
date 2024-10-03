import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except, Promisable } from 'type-fest';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeCreation } from '../../change.js';
import type {
  NodeCreationStatement,
  NodeCreationValue,
} from '../../statement/creation.js';
import type { NodeCreationInputValue } from '../../type/input/creation.js';
import {
  AbstractMutation,
  type AbstractMutationConfig,
  type AbstractMutationHookArgs,
} from '../abstract-mutation.js';

interface AbstractCreationHookArgs<
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
  readonly data: Readonly<NonNullable<NodeCreationInputValue>>;
}

export interface PreCreateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractCreationHookArgs<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {
  /**
   * The creation statement, as a mutable plain-object
   */
  readonly creation: NodeCreationValue;

  /**
   * The full creation-statement, with convenient methods
   */
  readonly statement: NodeCreationStatement;
}

export interface PostCreateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractCreationHookArgs<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {
  /**
   * The uncommitted change
   */
  readonly change: NodeCreation<TRequestContext>;
}

/**
 * Optional, fine-tune the "creation"
 */
export interface CreationConfig<
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
   * Optional, add some custom validation/logic over the "creation" statement that is about to be sent to the connector,
   *
   * Throwing an Error here will prevent the creation
   */
  preCreate?(
    args: PreCreateArgs<TRequestContext, TConnector, TBroker, TContainer>,
  ): Promisable<void>;

  /**
   * Optional, given the created node, add some custom logic before the result is returned
   *
   * Throwing an Error here will fail the creation
   */
  postCreate?(
    args: PostCreateArgs<TRequestContext, TConnector, TBroker, TContainer>,
  ): Promisable<void>;
}

export abstract class AbstractCreation<
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = any,
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = ConnectorInterface,
  TBroker extends BrokerInterface = BrokerInterface,
  TContainer extends object = object,
> extends AbstractMutation<
  TArgs,
  TResult,
  TRequestContext,
  TConnector,
  TBroker,
  TContainer
> {
  public readonly mutationTypes = [utils.MutationType.CREATION];
}
