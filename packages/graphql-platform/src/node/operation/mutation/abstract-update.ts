import * as utils from '@prismamedia/graphql-platform-utils';
import type { Promisable } from 'type-fest';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeValue } from '../../../node.js';
import type { UpdatedNode } from '../../change.js';
import type { NodeUpdateProxy } from '../../statement/update.js';
import type { NodeUpdateInputValue } from '../../type/input/update.js';
import {
  AbstractMutation,
  type AbstractMutationConfig,
  type AbstractMutationHookArgs,
} from '../abstract-mutation.js';

interface AbstractUpdateHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractMutationHookArgs<TRequestContext, TConnector> {
  /**
   * The provided "data" argument
   */
  readonly data: Readonly<utils.NonNillable<NodeUpdateInputValue>>;
}

export interface PreUpdateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractUpdateHookArgs<TRequestContext, TConnector> {
  /**
   * The current node's value
   */
  readonly currentValue: Readonly<NodeValue>;

  /**
   * The update statement, as a convenient object
   */
  readonly update: NodeUpdateProxy;
}

export interface PostUpdateArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractUpdateHookArgs<TRequestContext, TConnector> {
  /**
   * The uncommitted change
   */
  readonly change: UpdatedNode<TRequestContext, TConnector>;
}

/**
 * Optional, fine-tune the "update"
 */
export interface UpdateConfig<
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
   * Optional, add some custom validation/logic over the "update" statement that is about to be sent to the connector,
   *
   * Throwing an Error here will prevent the update
   */
  preUpdate?(
    args: PreUpdateArgs<TRequestContext, TConnector>,
  ): Promisable<void>;

  /**
   * Optional, given the "change", add some custom logic before the result is returned
   *
   * Throwing an Error here will fail the update
   */
  postUpdate?(
    args: PostUpdateArgs<TRequestContext, TConnector>,
  ): Promisable<void>;
}

export abstract class AbstractUpdate<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> extends AbstractMutation<TRequestContext, TConnector, TArgs, TResult> {
  public override readonly mutationTypes = [utils.MutationType.UPDATE] as const;
}
