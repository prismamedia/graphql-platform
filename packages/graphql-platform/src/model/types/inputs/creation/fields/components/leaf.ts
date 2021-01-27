import { Path } from '@prismamedia/graphql-platform-utils';
import { omit } from 'lodash';
import { Except, Promisable } from 'type-fest';
import { ConnectorInterface } from '../../../../../../connector';
import { Leaf, LeafValue } from '../../../../../components';
import { OperationContext } from '../../../../../operations/context';
import { CreationInputValue, PendingNodeCreation } from '../../../creation';
import {
  AbstractComponentInputField,
  AbstractComponentInputFieldConfig,
  AbstractComponentPreCreateArgs,
} from './abstract';

export type LeafInputFieldValue = LeafValue;

export type LeafInputFieldConfig<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> = Except<
  AbstractComponentInputFieldConfig<LeafValue>,
  'type' | 'assertValue' | 'nullable'
> & {
  /**
   * Optional, add some custom logic over the "leaf" value about to be sent to the connector
   */
  preCreate?(
    args: {
      /**
       * The "leaf"'s value provided by the client
       */
      leafValue: LeafValue | undefined;

      /**
       * The "leaf"'s definition
       */
      leaf: Leaf<TRequestContext, TConnector>;
    } & AbstractComponentPreCreateArgs<TRequestContext, TConnector>,
  ): Promisable<LeafValue | undefined>;
};

export class LeafInputField extends AbstractComponentInputField<
  LeafInputFieldValue | undefined,
  LeafValue | undefined
> {
  readonly #parser: LeafInputFieldConfig['preCreate'];

  public constructor(
    public readonly leaf: Leaf,
    config?: LeafInputFieldConfig,
  ) {
    super(leaf, {
      // defaults
      type: leaf.type,

      // config
      ...omit(config, ['preCreate']),
    });

    this.#parser = config?.preCreate;
  }

  public async parseValue(
    inputValue: LeafInputFieldValue | undefined,
    pendingCreation: Readonly<PendingNodeCreation>,
    data: Readonly<CreationInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<LeafValue | undefined> {
    const parsedValue = this.#parser
      ? await this.#parser({
          leafValue: Object.freeze(inputValue),
          leaf: this.leaf,
          creation: await this.getPartialCreation(pendingCreation),
          data,
          api: operationContext.createBoundAPI(path),
          path,
          operationContext,
        })
      : inputValue;

    return parsedValue !== undefined
      ? this.leaf.assertValue(parsedValue, path)
      : // We allow "undefined" here, for generated columns like "sequences / auto increments / default"
        undefined;
  }
}
