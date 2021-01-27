import { Input, InputConfig, Path } from '@prismamedia/graphql-platform-utils';
import { ConnectorInterface } from '../../../../../../connector';
import { Component } from '../../../../../components';
import {
  CommonUpdateOperationHookArgs,
  OperationContext,
} from '../../../../../operations';
import { NodeSelection } from '../../../../node/selection';
import { NodeValue } from '../../../../node/values';
import {
  NodeUpdate,
  PendingNodeUpdate,
  UpdateInputValue,
} from '../../../update';

export interface AbstractComponentPreUpdateHookArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends CommonUpdateOperationHookArgs<TRequestContext, TConnector> {
  /**
   * The result of the "dependsOnCurrentNodeValue" parameter's resolving
   */
  currentNodeValue: Readonly<NodeValue>;

  /**
   * The partial "update" about to be sent to the connector, only the components' update defined in the "dependsOnUpdate" parameter
   */
  update: Readonly<Partial<NodeUpdate>>;
}

export interface AbstractComponentInputFieldConfig<TValue>
  extends InputConfig<TValue> {
  /**
   * Optional, this component's "preUpdate" hook can depend on other components' update
   */
  dependsOnUpdate?: string[];
}

export abstract class AbstractComponentInputField<
  TInputValue,
  TParsedValue,
> extends Input<TInputValue> {
  readonly dependsOnUpdate: ReadonlySet<string>;

  public constructor(
    public readonly component: Component,
    {
      dependsOnUpdate,
      ...config
    }: AbstractComponentInputFieldConfig<TInputValue>,
  ) {
    super(component.name, {
      // defaults
      description: component.description,
      public: component.public,
      nullable: component.nullable,
      required: false,

      // config
      ...config,
    });

    this.dependsOnUpdate = new Set(dependsOnUpdate);
  }

  public abstract dependsOnCurrentNodeSelection(
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): NodeSelection | undefined;

  protected getCurrentNodeValue(
    currentNodeValue: Readonly<NodeValue> | undefined,
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Readonly<NodeValue> {
    return Object.freeze(
      this.dependsOnCurrentNodeSelection(
        data,
        operationContext,
        path,
      )?.assertValue(currentNodeValue, path) ?? {},
    );
  }

  protected async getPartialUpdate(
    pendingUpdate: Readonly<PendingNodeUpdate>,
  ): Promise<Readonly<Partial<NodeUpdate>>> {
    return Object.freeze(
      Object.fromEntries(
        await Promise.all(
          Array.from(this.dependsOnUpdate, async (componentName) => [
            componentName,
            await pendingUpdate[componentName],
          ]),
        ),
      ),
    );
  }

  public abstract parseValue(
    inputValue: TInputValue,
    currentNodeValue: Readonly<NodeValue> | undefined,
    pendingUpdate: Readonly<PendingNodeUpdate>,
    data: Readonly<UpdateInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<TParsedValue>;
}
