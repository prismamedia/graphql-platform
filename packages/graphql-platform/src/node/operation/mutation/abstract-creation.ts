import * as utils from '@prismamedia/graphql-platform-utils';
import type { Promisable } from 'type-fest';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeCreation } from '../../change.js';
import type { NodeCreationStatementProxy } from '../../statement/creation.js';
import type { NodeCreationInputValue } from '../../type/input/creation.js';
import {
  AbstractMutation,
  type AbstractMutationConfig,
  type AbstractMutationHookArgs,
} from '../abstract-mutation.js';

interface AbstractCreationHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractMutationHookArgs<TRequestContext, TConnector> {
  /**
   * The provided "data" argument
   */
  readonly data: Readonly<utils.NonNillable<NodeCreationInputValue>>;
}

export interface PreCreateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractCreationHookArgs<TRequestContext, TConnector> {
  /**
   * The creation statement, as a convenient object
   */
  readonly creation: NodeCreationStatementProxy;
}

export interface PostCreateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractCreationHookArgs<TRequestContext, TConnector> {
  /**
   * The uncommitted change
   */
  readonly change: NodeCreation<TRequestContext, TConnector>;
}

/**
 * Optional, fine-tune the "creation"
 */
export interface CreationConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractMutationConfig<TRequestContext, TConnector> {
  /**
   * Optional, add some "virtual" fields whose values can be used in the hooks
   */
  virtualFields?: Record<
    utils.InputConfig['name'],
    Omit<utils.InputConfig, 'name'>
  >;

  /**
   * Optional, add some custom validation/logic over the "creation" statement that is about to be sent to the connector,
   *
   * Throwing an Error here will prevent the creation
   */
  preCreate?(
    args: PreCreateArgs<TRequestContext, TConnector>,
  ): Promisable<void>;

  /**
   * Optional, given the created node, add some custom logic before the result is returned
   *
   * Throwing an Error here will fail the creation
   */
  postCreate?(
    args: PostCreateArgs<TRequestContext, TConnector>,
  ): Promisable<void>;
}

export abstract class AbstractCreation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> extends AbstractMutation<TRequestContext, TConnector, TArgs, TResult> {
  public override readonly mutationTypes = [
    utils.MutationType.CREATION,
  ] as const;
}
