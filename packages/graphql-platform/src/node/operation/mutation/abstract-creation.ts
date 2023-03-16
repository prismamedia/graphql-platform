import * as utils from '@prismamedia/graphql-platform-utils';
import type { Except, Promisable } from 'type-fest';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeCreation } from '../../change.js';
import type { NodeCreationValue } from '../../statement/creation.js';
import type { NodeCreationInputValue } from '../../type/input/creation.js';
import {
  AbstractMutation,
  type AbstractMutationConfig,
  type AbstractMutationHookArgs,
} from '../abstract-mutation.js';

interface AbstractCreationHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> extends AbstractMutationHookArgs<TRequestContext, TConnector, TContainer> {
  /**
   * The provided "data" argument
   */
  readonly data: Readonly<NonNullable<NodeCreationInputValue>>;
}

export interface PreCreateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> extends AbstractCreationHookArgs<TRequestContext, TConnector, TContainer> {
  /**
   * The creation statement, as a mutable object
   */
  readonly creation: NodeCreationValue;
}

export interface PostCreateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> extends AbstractCreationHookArgs<TRequestContext, TConnector, TContainer> {
  /**
   * The uncommitted change
   */
  readonly change: NodeCreation<TRequestContext>;
}

/**
 * Optional, fine-tune the "creation"
 */
export interface CreationConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> extends AbstractMutationConfig<TRequestContext, TConnector, TContainer> {
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
    args: PreCreateArgs<TRequestContext, TConnector, TContainer>,
  ): Promisable<void>;

  /**
   * Optional, given the created node, add some custom logic before the result is returned
   *
   * Throwing an Error here will fail the creation
   */
  postCreate?(
    args: PostCreateArgs<TRequestContext, TConnector, TContainer>,
  ): Promisable<void>;
}

export abstract class AbstractCreation<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> extends AbstractMutation<TRequestContext, TArgs, TResult> {
  public override readonly mutationTypes = [
    utils.MutationType.CREATION,
  ] as const;
}
