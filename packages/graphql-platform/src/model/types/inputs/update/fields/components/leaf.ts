import { Path } from '@prismamedia/graphql-platform-utils';
import { omit } from 'lodash';
import { Except, Promisable } from 'type-fest';
import { ConnectorInterface } from '../../../../../../connector';
import { Leaf, LeafValue } from '../../../../../components';
import { OperationContext } from '../../../../../operations/context';
import { DependsOnCurrentNodeValueArgs } from '../../../../../operations/mutations/update/config';
import {
  ComponentNames,
  Fragment,
  NodeSelection,
  NodeValue,
} from '../../../../node';
import { PendingNodeUpdate, UpdateInputValue } from '../../../update';
import {
  AbstractComponentInputField,
  AbstractComponentInputFieldConfig,
  AbstractComponentPreUpdateHookArgs,
} from './abstract';

export type LeafInputFieldValue = LeafValue;

export type LeafUpdate = LeafValue;

export type LeafInputFieldConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = Except<
  AbstractComponentInputFieldConfig<LeafInputFieldValue>,
  'type' | 'assertValue' | 'nullable'
> & {
  /**
   * Optional, the "leaf"'s "preUpdate" hook can depend on the current node's value
   *
   * expects a "fragment" as a string or an iterable of component names
   */
  dependsOnCurrentNodeValue?:
    | ((
        args: {
          /**
           * The "leaf"'s update provided by the client
           */
          leafUpdate: LeafUpdate | undefined;

          /**
           * The "leaf"'s definition
           */
          leaf: Leaf<TRequestContext, TConnector>;
        } & DependsOnCurrentNodeValueArgs<TRequestContext, TConnector>,
      ) => Fragment | ComponentNames | undefined)
    | (Fragment | ComponentNames | undefined);

  /**
   * Optional, add some custom logic over the "leaf"'s update about to be sent to the connector
   */
  preUpdate?(
    args: {
      /**
       * The "leaf"'s update provided by the client
       */
      leafUpdate: LeafUpdate | undefined;

      /**
       * The "leaf"'s definition
       */
      leaf: Leaf<TRequestContext, TConnector>;
    } & AbstractComponentPreUpdateHookArgs<TRequestContext, TConnector>,
  ): Promisable<LeafUpdate | undefined>;
};

export class LeafInputField extends AbstractComponentInputField<
  LeafInputFieldValue | undefined,
  LeafUpdate | undefined
> {
  readonly #dependsOnCurrent: LeafInputFieldConfig['dependsOnCurrentNodeValue'];
  readonly #parser: LeafInputFieldConfig['preUpdate'];

  public constructor(
    public readonly leaf: Leaf,
    config?: LeafInputFieldConfig,
  ) {
    super(leaf, {
      // defaults
      type: leaf.type,

      // config
      ...omit(config, ['dependsOnCurrentNodeValue', 'preUpdate']),
    });

    this.#dependsOnCurrent = config?.dependsOnCurrentNodeValue;
    this.#parser = config?.preUpdate;
  }

  public dependsOnCurrentNodeSelection(
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): NodeSelection | undefined {
    const rawNodeSelection =
      typeof this.#dependsOnCurrent === 'function'
        ? this.#dependsOnCurrent({
            leafUpdate: Object.freeze(data[this.name]),
            data,
            leaf: this.leaf,
            path,
            operationContext,
          })
        : this.#dependsOnCurrent;

    return rawNodeSelection
      ? this.leaf.model.nodeType.select(rawNodeSelection, path)
      : undefined;
  }

  public async parseValue(
    inputValue: LeafInputFieldValue | undefined,
    currentNodeValue: Readonly<NodeValue> | undefined,
    pendingUpdate: Readonly<PendingNodeUpdate>,
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<LeafUpdate | undefined> {
    const parsedUpdate = this.#parser
      ? await this.#parser({
          leafUpdate: Object.freeze(inputValue),
          leaf: this.leaf,
          update: await this.getPartialUpdate(pendingUpdate),
          currentNodeValue: this.getCurrentNodeValue(
            currentNodeValue,
            data,
            operationContext,
            path,
          ),
          data,
          api: operationContext.createBoundAPI(path),
          path,
          operationContext,
        })
      : inputValue;

    return parsedUpdate !== undefined
      ? this.leaf.assertValue(parsedUpdate, path)
      : undefined;
  }
}
