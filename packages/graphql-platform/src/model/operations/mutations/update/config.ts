import { Promisable } from 'type-fest';
import { ConnectorInterface } from '../../../../connector';
import { Model } from '../../../../model';
import {
  NodeUpdate,
  UpdateInputValue,
  VirtualInputFieldConfig,
} from '../../../types/inputs/update';
import {
  ComponentNames,
  Fragment,
  NodeRecord,
  NodeValue,
} from '../../../types/node';
import { AbstractMutationConfig, CommonHookArgs } from '../abstract';

export type CommonUpdateOperationHookArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = {
  /**
   * The raw "data" argument provided by the client
   */
  data: Readonly<UpdateInputValue>;
} & CommonHookArgs<TRequestContext, TConnector>;

export type DependsOnCurrentNodeValueArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> = Omit<CommonUpdateOperationHookArgs<TRequestContext, TConnector>, 'api'>;

export interface UpdateOperationConfig<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutationConfig {
  /**
   * Optional, add some "virtual" fields whose values can be used in "pre/post-update" hooks
   */
  virtualFields?: Record<string, VirtualInputFieldConfig>;

  /**
   * Optional, the "preUpdate" hook can depend on the current node's value
   *
   * expects a "fragment" as a string or an iterable of component names
   */
  dependsOnCurrentNodeValue?:
    | ((
        args: {
          /**
           * The "model"'s definition
           */
          model: Model<TRequestContext, TConnector>;
        } & DependsOnCurrentNodeValueArgs<TRequestContext, TConnector>,
      ) => Fragment | ComponentNames | undefined)
    | (Fragment | ComponentNames | undefined);

  /**
   * Optional, add some custom logic over the "update" about to be sent to the connector
   */
  preUpdate?: (
    args: {
      /**
       * The result of the "dependsOnCurrentNodeValue" parameter's resolving
       */
      currentNodeValue: Readonly<NodeValue>;

      /**
       * The "update" about to be sent to the connector
       */
      update: Readonly<NodeUpdate>;

      /**
       * The "model"'s definition
       */
      model: Model<TRequestContext, TConnector>;
    } & CommonUpdateOperationHookArgs<TRequestContext, TConnector>,
  ) => Promisable<NodeUpdate>;

  /**
   * Optional, given the updated record, add some custom logic before the result is returned
   *
   * Keep in mind that an error thrown in this hook will fail the whole operation
   */
  postUpdate?: (
    args: {
      /**
       * The updated "record"
       */
      record: Readonly<NodeRecord>;

      /**
       * The "model"'s definition
       */
      model: Model<TRequestContext, TConnector>;
    } & CommonUpdateOperationHookArgs<TRequestContext, TConnector>,
  ) => Promisable<void>;
}
