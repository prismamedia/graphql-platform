import {
  addPath,
  aggregateConcurrentError,
  aggregateConfigError,
  assertNillablePlainObjectConfig,
  Input,
  MutationType,
  ObjectInputType,
  UnexpectedConfigError,
  type InputConfig,
  type Name,
  type Nillable,
  type NonNillable,
  type Path,
  type PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { Except } from 'type-fest';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node, NodeValue } from '../../../node.js';
import type { MutationContext } from '../../operation.js';
import { NodeUpdate } from '../../statement/update.js';
import type {
  ComponentUpdateInput,
  FieldUpdateInput,
  ReverseEdgeUpdateInput,
} from './update/field.js';

export type NodeUpdateInputValue = Nillable<PlainObject>;

export class NodeUpdateInputType<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends ObjectInputType<FieldUpdateInput> {
  public constructor(public readonly node: Node<TRequestContext, TConnector>) {
    super({
      name: `${node.name}UpdateInput`,
      description: `The "${node.name}" node's ${MutationType.UPDATE}`,
    });
  }

  @Memoize()
  protected get componentFields(): ReadonlyArray<ComponentUpdateInput> {
    return Array.from(this.node.componentsByName.values()).reduce<
      ComponentUpdateInput[]
    >(
      (fields, component) =>
        component.updateInput ? [...fields, component.updateInput] : fields,
      [],
    );
  }

  @Memoize()
  protected get reverseEdgeFields(): ReadonlyArray<ReverseEdgeUpdateInput> {
    return Array.from(this.node.reverseEdgesByName.values()).reduce<
      ReverseEdgeUpdateInput[]
    >(
      (fields, reverseEdge) =>
        reverseEdge.updateInput ? [...fields, reverseEdge.updateInput] : fields,
      [],
    );
  }

  @Memoize()
  protected get virtualFields(): ReadonlyArray<Input> {
    const { config, configPath } = this.node.getMutationConfig(
      MutationType.UPDATE,
    );

    const virtualFieldsConfig = config?.virtualFields;
    const virtualFieldsConfigPath = addPath(configPath, 'virtualFields');

    assertNillablePlainObjectConfig(
      virtualFieldsConfig,
      virtualFieldsConfigPath,
    );

    return virtualFieldsConfig
      ? aggregateConfigError<[Name, Except<InputConfig, 'name'>], Input[]>(
          Object.entries(virtualFieldsConfig),
          (fields, [virtualFieldName, virtualFieldConfig]) => {
            if (this.node.componentsByName.has(virtualFieldName)) {
              throw new UnexpectedConfigError(
                `not to have a component's name`,
                virtualFieldName,
                { path: virtualFieldsConfigPath },
              );
            } else if (this.node.reverseEdgesByName.has(virtualFieldName)) {
              throw new UnexpectedConfigError(
                `not to have a reverse-edge's name`,
                virtualFieldName,
                { path: virtualFieldsConfigPath },
              );
            }

            return [
              ...fields,
              new Input(
                { ...virtualFieldConfig, name: virtualFieldName },
                addPath(virtualFieldsConfigPath, virtualFieldName),
              ),
            ];
          },
          [],
          { path: virtualFieldsConfigPath },
        )
      : [];
  }

  @Memoize()
  public override get fields(): ReadonlyArray<FieldUpdateInput> {
    return Object.freeze([
      ...this.componentFields,
      ...this.reverseEdgeFields,
      ...this.virtualFields,
    ]);
  }

  @Memoize()
  public override isPublic(): boolean {
    return (
      this.node.isMutationPublic(MutationType.UPDATE) &&
      super.isPublic() &&
      this.componentFields.some((field) => field.isPublic())
    );
  }

  public async createStatement(
    data: Readonly<NonNillable<NodeUpdateInputValue>>,
    context: MutationContext,
    path: Path = addPath(undefined, this.name),
  ): Promise<NodeUpdate<TRequestContext, TConnector>> {
    const statement = new NodeUpdate(this.node);

    await aggregateConcurrentError(
      this.componentFields,
      async (field) => {
        const fieldData = data[field.name];

        statement.set(
          field.component,
          fieldData == null
            ? fieldData
            : await field.resolveComponentUpdate(
                fieldData,
                context,
                addPath(path, field.name),
              ),
        );
      },
      { path },
    );

    return statement;
  }

  public hasReverseEdgeActions(
    data: Readonly<NonNillable<NodeUpdateInputValue>>,
  ): boolean {
    return this.reverseEdgeFields.some((field) => data[field.name] != null);
  }

  public async applyReverseEdgeActions(
    nodeValue: NodeValue,
    data: Readonly<NonNillable<NodeUpdateInputValue>>,
    context: MutationContext,
    path?: Path,
  ): Promise<void> {
    await aggregateConcurrentError(
      this.reverseEdgeFields,
      async (field) => {
        const fieldData = data[field.name];
        if (fieldData != null) {
          await field.applyActions(
            nodeValue,
            fieldData,
            context,
            addPath(path, field.name),
          );
        }
      },
      { path },
    );
  }
}
