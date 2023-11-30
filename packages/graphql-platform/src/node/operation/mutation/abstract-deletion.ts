import * as utils from '@prismamedia/graphql-platform-utils';
import type { Promisable } from 'type-fest';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeValue } from '../../../node.js';
import type { NodeDeletion } from '../../change.js';
import type { UniqueConstraintValue } from '../../definition.js';
import {
  AbstractMutation,
  type AbstractMutationConfig,
  type AbstractMutationHookArgs,
} from '../abstract-mutation.js';

interface AbstractDeletionHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractMutationHookArgs<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {}

export interface PreDeleteArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractDeletionHookArgs<
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
}

export interface PostDeleteArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> extends AbstractDeletionHookArgs<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  > {
  /**
   * The uncommitted change
   */
  readonly change: NodeDeletion<TRequestContext>;
}

/**
 * Optional, fine-tune the "deletion"
 */
export interface DeletionConfig<
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
   * Optional, add some custom validation/logic over the "update" statement that is about to be sent to the connector,
   *
   * Throwing an Error here will prevent the deletion
   */
  preDelete?(
    args: PreDeleteArgs<TRequestContext, TConnector, TBroker, TContainer>,
  ): Promisable<void>;

  /**
   * Optional, given the deleted node, add some custom logic before the result is returned
   *
   * Throwing an Error here will fail the deletion
   */
  postDelete?(
    args: PostDeleteArgs<TRequestContext, TConnector, TBroker, TContainer>,
  ): Promisable<void>;
}

export abstract class AbstractDeletion<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> extends AbstractMutation<TRequestContext, TArgs, TResult> {
  public readonly mutationTypes = [utils.MutationType.DELETION];
}
