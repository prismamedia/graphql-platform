import { Input, InputConfig, Path } from '@prismamedia/graphql-platform-utils';
import { ConnectorInterface } from '../../../../../../connector';
import { Component } from '../../../../../components';
import {
  CommonCreateOperationHookArgs,
  OperationContext,
} from '../../../../../operations';
import {
  CreationInputValue,
  NodeCreation,
  PendingNodeCreation,
} from '../../../creation';

export interface AbstractComponentPreCreateArgs<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends CommonCreateOperationHookArgs<TRequestContext, TConnector> {
  /**
   * The partial "creation" about to be sent to the connector, only the components' value defined in the "dependsOnCreation" parameter
   */
  creation: Readonly<Partial<NodeCreation>>;
}

export interface AbstractComponentInputFieldConfig<TValue>
  extends InputConfig<TValue> {
  /**
   * Optional, this component's "preCreate" hook can depend on other components' value
   */
  dependsOnCreation?: string[];
}

export abstract class AbstractComponentInputField<
  TInputValue,
  TParsedValue,
> extends Input<TInputValue> {
  readonly dependsOnCreation: ReadonlySet<string>;

  public constructor(
    public readonly component: Component,
    {
      dependsOnCreation,
      ...config
    }: AbstractComponentInputFieldConfig<TInputValue>,
  ) {
    super(component.name, {
      // defaults
      description: component.description,
      public: component.public,
      nullable: component.nullable,

      // config
      ...config,
    });

    this.dependsOnCreation = new Set(dependsOnCreation);
  }

  protected async getPartialCreation(
    pendingCreation: Readonly<PendingNodeCreation>,
  ): Promise<Readonly<Partial<NodeCreation>>> {
    return Object.freeze(
      Object.fromEntries(
        await Promise.all(
          Array.from(this.dependsOnCreation, async (componentName) => [
            componentName,
            await pendingCreation[componentName],
          ]),
        ),
      ),
    );
  }

  public abstract parseValue(
    inputValue: TInputValue,
    pendingCreation: Readonly<PendingNodeCreation>,
    data: Readonly<CreationInputValue>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<TParsedValue>;
}
