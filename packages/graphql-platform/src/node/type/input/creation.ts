import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { Except } from 'type-fest';
import type { Edge, Node, NodeValue } from '../../../node.js';
import type { MutationContext } from '../../operation.js';
import type { NodeCreationValue } from '../../statement/creation.js';
import {
  ComponentCreationInput,
  FieldCreationInput,
  LeafCreationInput,
  ReverseEdgeCreationInput,
} from './creation/field.js';

export * from './creation/field.js';

export type NodeCreationInputValue = utils.Nillable<utils.PlainObject>;

export class NodeCreationInputType extends utils.ObjectInputType<FieldCreationInput> {
  public constructor(
    public readonly node: Node,
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
    return this.node.components.reduce<ComponentCreationInput[]>(
      (fields, component) =>
        component !== this.forcedEdge
          ? [...fields, component.creationInput]
          : fields,
      [],
    );
  }

  @Memoize()
  protected get reverseEdgeFields(): ReadonlyArray<ReverseEdgeCreationInput> {
    return this.node.reverseEdges.reduce<ReverseEdgeCreationInput[]>(
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
      ? utils.aggregateGraphError<
          [utils.Name, Except<utils.InputConfig, 'name'>],
          utils.Input[]
        >(
          Object.entries(virtualFieldsConfig),
          (fields, [virtualFieldName, virtualFieldConfig]) => {
            if (this.node.componentsByName.has(virtualFieldName)) {
              throw new utils.UnexpectedValueError(
                `not to have a component's name`,
                virtualFieldName,
                { path: virtualFieldsConfigPath },
              );
            } else if (this.node.reverseEdgesByName.has(virtualFieldName)) {
              throw new utils.UnexpectedValueError(
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

  public async resolveValue(
    data: Readonly<NonNullable<NodeCreationInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<NodeCreationValue> {
    const resolvedValue: NodeCreationValue = Object.create(null);

    await Promise.all(
      this.componentFields.map(async (field) => {
        const fieldData = data[field.name];

        resolvedValue[field.name] =
          fieldData == null || field instanceof LeafCreationInput
            ? fieldData
            : await field.resolveValue(
                fieldData,
                context,
                utils.addPath(path, field.name),
              );
      }),
    );

    return resolvedValue;
  }

  public hasReverseEdgeActions(
    data: Readonly<NonNullable<NodeCreationInputValue>>,
  ): boolean {
    return this.reverseEdgeFields.some((field) => data[field.name] != null);
  }

  public async applyReverseEdgeActions(
    nodeValue: Readonly<NodeValue>,
    data: Readonly<NonNullable<NodeCreationInputValue>>,
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
