import { Promisable } from 'type-fest';
import { ConnectorInterface } from '../../../../connector';
import { Model } from '../../../../model';
import {
  CreationInputValue,
  NodeCreation,
  VirtualInputFieldConfig,
} from '../../../types/inputs/creation';
import { NodeRecord } from '../../../types/node';
import { AbstractMutationConfig, CommonHookArgs } from '../abstract';

export type CommonCreateOperationHookArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = {
  /**
   * The raw "data" argument provided by the client
   */
  data: Readonly<CreationInputValue>;
} & CommonHookArgs<TRequestContext, TConnector>;

export interface CreateOperationConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutationConfig {
  /**
   * Optional, add some "virtual" fields whose values can be used in "pre/post-create" hooks
   */
  virtualFields?: Record<string, VirtualInputFieldConfig>;

  /**
   * Optional, add some custom logic over the "creation" about to be sent to the connector
   */
  preCreate?: (
    args: {
      /**
       * The "creation" about to be sent to the connector
       */
      creation: Readonly<NodeCreation>;

      /**
       * The "model"'s definition
       */
      model: Model<TRequestContext, TConnector>;
    } & CommonCreateOperationHookArgs<TRequestContext, TConnector>,
  ) => Promisable<NodeCreation>;

  /**
   * Optional, given the created record, add some custom logic before the result is returned
   *
   * Keep in mind that an error thrown in this hook will fail the whole operation
   */
  postCreate?: (
    args: {
      /**
       * The created "record"
       */
      record: Readonly<NodeRecord>;

      /**
       * The "model"'s definition
       */
      model: Model<TRequestContext, TConnector>;
    } & CommonCreateOperationHookArgs<TRequestContext, TConnector>,
  ) => Promisable<void>;
}
