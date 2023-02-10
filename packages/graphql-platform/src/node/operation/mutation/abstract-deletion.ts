import * as utils from '@prismamedia/graphql-platform-utils';
import type { Promisable } from 'type-fest';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeValue } from '../../../node.js';
import type { NodeDeletion } from '../../change.js';
import {
  AbstractMutation,
  type AbstractMutationConfig,
  type AbstractMutationHookArgs,
} from '../abstract-mutation.js';

interface AbstractDeletionHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TServiceContainer extends object,
> extends AbstractMutationHookArgs<
    TRequestContext,
    TConnector,
    TServiceContainer
  > {}

export interface PreDeleteArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TServiceContainer extends object,
> extends AbstractDeletionHookArgs<
    TRequestContext,
    TConnector,
    TServiceContainer
  > {
  /**
   * The current node's value
   */
  readonly currentValue: Readonly<NodeValue>;
}

export interface PostDeleteArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TServiceContainer extends object,
> extends AbstractDeletionHookArgs<
    TRequestContext,
    TConnector,
    TServiceContainer
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
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TServiceContainer extends object,
> extends AbstractMutationConfig<
    TRequestContext,
    TConnector,
    TServiceContainer
  > {
  /**
   * Optional, add some custom validation/logic over the "update" statement that is about to be sent to the connector,
   *
   * Throwing an Error here will prevent the deletion
   */
  preDelete?(
    args: PreDeleteArgs<TRequestContext, TConnector, TServiceContainer>,
  ): Promisable<void>;

  /**
   * Optional, given the deleted node, add some custom logic before the result is returned
   *
   * Throwing an Error here will fail the deletion
   */
  postDelete?(
    args: PostDeleteArgs<TRequestContext, TConnector, TServiceContainer>,
  ): Promisable<void>;
}

export abstract class AbstractDeletion<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> extends AbstractMutation<TRequestContext, TArgs, TResult> {
  public override readonly mutationTypes = [
    utils.MutationType.DELETION,
  ] as const;
}
