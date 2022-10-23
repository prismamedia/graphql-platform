import * as utils from '@prismamedia/graphql-platform-utils';
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

export * from './creation/field.js';

export type NodeCreationInputValue = utils.Nillable<utils.PlainObject>;

export class NodeCreationInputType<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends utils.ObjectInputType<FieldCreationInput> {
  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly forcedEdge?: Edge,
  ) {
    forcedEdge && assert.equal(forcedEdge.tail, node);

    super({
      name: forcedEdge
        ? `${node}CreationWithout${inflection.capitalize(forcedEdge.name)}Input`
        : `${node}CreationInput`,
      description: `The "${node}" node's ${utils.MutationType.CREATION}`,
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
  protected get virtualFields(): ReadonlyArray<utils.Input> {
    const { config, configPath } = this.node.getMutationConfig(
      utils.MutationType.CREATION,
    );

    const virtualFieldsConfig = config?.virtualFields;
    const virtualFieldsConfigPath = utils.addPath(configPath, 'virtualFields');

    utils.assertNillablePlainObjectConfig(
      virtualFieldsConfig,
      virtualFieldsConfigPath,
    );

    return virtualFieldsConfig
      ? utils.aggregateConfigError<
          [utils.Name, Except<utils.InputConfig, 'name'>],
          utils.Input[]
        >(
          Object.entries(virtualFieldsConfig),
          (fields, [virtualFieldName, virtualFieldConfig]) => {
            if (this.node.componentsByName.has(virtualFieldName)) {
              throw new utils.UnexpectedConfigError(
                `not to have a component's name`,
                virtualFieldName,
                { path: virtualFieldsConfigPath },
              );
            } else if (this.node.reverseEdgesByName.has(virtualFieldName)) {
              throw new utils.UnexpectedConfigError(
                `not to have a reverse-edge's name`,
                virtualFieldName,
                { path: virtualFieldsConfigPath },
              );
            }

            return [
              ...fields,
              new utils.Input(
                { ...virtualFieldConfig, name: virtualFieldName },
                utils.addPath(virtualFieldsConfigPath, virtualFieldName),
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
    return [
      ...this.componentFields,
      ...this.reverseEdgeFields,
      ...this.virtualFields,
    ];
  }

  @Memoize()
  public override isPublic(): boolean {
    return (
      this.node.isMutationPublic(utils.MutationType.CREATION) &&
      super.isPublic() &&
      this.componentFields.some((field) => field.isPublic())
    );
  }

  public async createStatement(
    data: Readonly<utils.NonNillable<NodeCreationInputValue>>,
    context: MutationContext,
    path: utils.Path = utils.addPath(undefined, this.name),
  ): Promise<NodeCreation<TRequestContext, TConnector>> {
    const statement = new NodeCreation(this.node);

    await Promise.all(
      this.componentFields.map(async (field) => {
        const fieldData = data[field.name];

        statement.setComponentValue(
          field.component,
          fieldData == null
            ? fieldData
            : await field.resolveComponentValue(
                fieldData,
                context,
                utils.addPath(path, field.name),
              ),
        );
      }),
    );

    return statement;
  }

  public hasReverseEdgeActions(
    data: Readonly<utils.NonNillable<NodeCreationInputValue>>,
  ): boolean {
    return this.reverseEdgeFields.some((field) => data[field.name] != null);
  }

  public async applyReverseEdgeActions(
    nodeValue: Readonly<NodeValue>,
    data: Readonly<utils.NonNillable<NodeCreationInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<void> {
    await Promise.all(
      this.reverseEdgeFields.map(async (field) => {
        const fieldData = data[field.name];

        if (fieldData != null) {
          await field.applyActions(
            nodeValue,
            fieldData,
            context,
            utils.addPath(path, field.name),
          );
        }
      }),
    );
  }
}
