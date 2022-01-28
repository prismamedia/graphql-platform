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
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { Except } from 'type-fest';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node, NodeValue } from '../../../node.js';
import type { Edge } from '../../definition.js';
import type { MutationContext } from '../../operation.js';
import { NodeCreation } from '../../statement/creation.js';
import type {
  ComponentCreationInput,
  FieldCreationInput,
  ReverseEdgeCreationInput,
} from './creation/field.js';

export type NodeCreationInputValue = Nillable<PlainObject>;

export class NodeCreationInputType<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends ObjectInputType<FieldCreationInput> {
  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly forcedEdge?: Edge,
  ) {
    forcedEdge && assert.equal(forcedEdge.tail, node);

    super({
      name: forcedEdge
        ? `${node.name}CreationWithout${inflection.capitalize(
            forcedEdge.name,
          )}Input`
        : `${node.name}CreationInput`,
      description: `The "${node.name}" node's ${MutationType.CREATION}`,
    });
  }

  @Memoize()
  protected get componentFields(): ReadonlyArray<ComponentCreationInput> {
    return Array.from(this.node.componentsByName.values()).reduce<
      ComponentCreationInput[]
    >(
      (fields, component) =>
        component !== this.forcedEdge && component.creationInput
          ? [...fields, component.creationInput]
          : fields,
      [],
    );
  }

  @Memoize()
  protected get reverseEdgeFields(): ReadonlyArray<ReverseEdgeCreationInput> {
    return Array.from(this.node.reverseEdgesByName.values()).reduce<
      ReverseEdgeCreationInput[]
    >(
      (fields, reverseEdge) =>
        reverseEdge.creationInput
          ? [...fields, reverseEdge.creationInput]
          : fields,
      [],
    );
  }

  @Memoize()
  protected get virtualFields(): ReadonlyArray<Input> {
    const { config, configPath } = this.node.getMutationConfig(
      MutationType.CREATION,
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
  public override get fields(): ReadonlyArray<FieldCreationInput> {
    return Object.freeze([
      ...this.componentFields,
      ...this.reverseEdgeFields,
      ...this.virtualFields,
    ]);
  }

  @Memoize()
  public override isPublic(): boolean {
    return (
      this.node.isMutationPublic(MutationType.CREATION) &&
      super.isPublic() &&
      this.componentFields.some((field) => field.isPublic())
    );
  }

  public async createStatement(
    data: Readonly<NonNillable<NodeCreationInputValue>>,
    context: MutationContext,
    path: Path = addPath(undefined, this.name),
  ): Promise<NodeCreation<TRequestContext, TConnector>> {
    const statement = new NodeCreation(this.node);

    await aggregateConcurrentError(
      this.componentFields,
      async (field) => {
        const fieldData = data[field.name];

        statement.setComponentValue(
          field.component,
          fieldData == null
            ? fieldData
            : await field.resolveComponentValue(
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
    data: Readonly<NonNillable<NodeCreationInputValue>>,
  ): boolean {
    return this.reverseEdgeFields.some((field) => data[field.name] != null);
  }

  public async applyReverseEdgeActions(
    nodeValue: Readonly<NodeValue>,
    data: Readonly<NonNillable<NodeCreationInputValue>>,
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
