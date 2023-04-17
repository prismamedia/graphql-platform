import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { Except } from 'type-fest';
import type { Edge, Node, NodeValue } from '../../../node.js';
import type { MutationContext } from '../../operation.js';
import type { NodeUpdateValue } from '../../statement/update.js';
import {
  ComponentUpdateInput,
  FieldUpdateInput,
  LeafUpdateInput,
  ReverseEdgeUpdateInput,
} from './update/field.js';

export * from './update/field.js';

export type NodeUpdateInputValue = utils.Nillable<utils.PlainObject>;

export class NodeUpdateInputType extends utils.ObjectInputType<FieldUpdateInput> {
  public constructor(
    public readonly node: Node,
    public readonly forcedEdge?: Edge,
  ) {
    if (forcedEdge) {
      assert.equal(forcedEdge.tail, node);
      assert(forcedEdge.isMutable());
    }

    super({
      name: forcedEdge
        ? `${node}UpdateWithout${inflection.capitalize(forcedEdge.name)}Input`
        : `${node}UpdateInput`,
      description: `The "${node}" node's ${utils.MutationType.UPDATE}`,
    });
  }

  @Memoize()
  protected get componentFields(): ReadonlyArray<ComponentUpdateInput> {
    return Array.from(this.node.componentsByName.values()).reduce<
      ComponentUpdateInput[]
    >(
      (fields, component) =>
        component.isMutable() && component !== this.forcedEdge
          ? [...fields, component.updateInput]
          : fields,
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
  protected get virtualFields(): ReadonlyArray<utils.Input> {
    const { config, configPath } = this.node.getMutationConfig(
      utils.MutationType.UPDATE,
    );

    const virtualFieldsConfig = config?.virtualFields;
    const virtualFieldsConfigPath = utils.addPath(configPath, 'virtualFields');

    utils.assertNillablePlainObject(
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
  public override get fields(): ReadonlyArray<FieldUpdateInput> {
    return [
      ...this.componentFields,
      ...this.reverseEdgeFields,
      ...this.virtualFields,
    ];
  }

  @Memoize()
  public override isPublic(): boolean {
    return (
      this.node.isMutationPublic(utils.MutationType.UPDATE) &&
      super.isPublic() &&
      this.componentFields.some((field) => field.isPublic())
    );
  }

  public async resolveValue(
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<NodeUpdateValue> {
    const resolvedValue: NodeUpdateValue = Object.create(null);

    await Promise.all(
      this.componentFields.map(async (field) => {
        const fieldData = data[field.name];

        resolvedValue[field.name] =
          fieldData == null || field instanceof LeafUpdateInput
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
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
  ): boolean {
    return this.reverseEdgeFields.some((field) => data[field.name] != null);
  }

  public async applyReverseEdgeActions(
    nodeValue: NodeValue,
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
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
