import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert';
import * as R from 'remeda';
import type { Except } from 'type-fest';
import type {
  Component,
  Edge,
  Node,
  NodeValue,
  ReverseEdge,
} from '../../../node.js';
import type { MutationContext } from '../../operation.js';
import type { NodeUpdateValue } from '../../statement/update.js';
import {
  type ComponentUpdateInput,
  EdgeUpdateInput,
  type FieldUpdateInput,
  LeafUpdateInput,
  type ReverseEdgeUpdateInput,
} from './update/field.js';

export * from './update/field.js';

export type NodeUpdateInputValue = utils.Nillable<utils.PlainObject>;

export class NodeUpdateInputType extends utils.ObjectInputType<FieldUpdateInput> {
  readonly #excludedEdge?: Edge;

  public constructor(
    public readonly node: Node,
    excludedEdge?: Edge,
  ) {
    assert(
      node.isUpdatable(excludedEdge),
      `The "${node}" node is not updatable`,
    );

    super({
      name: [
        node.name,
        inflection.camelize(utils.MutationType.UPDATE),
        excludedEdge
          ? `Without${inflection.camelize(excludedEdge.name)}`
          : undefined,
        'Input',
      ]
        .filter(Boolean)
        .join(''),
      description: `The "${node}" node's ${utils.MutationType.UPDATE}`,
    });

    this.#excludedEdge = excludedEdge;
  }

  @MGetter
  public get componentFields(): ReadonlyArray<ComponentUpdateInput> {
    return this.node.componentsByName
      .values()
      .reduce<ComponentUpdateInput[]>((fields, component) => {
        if (component !== this.#excludedEdge && component.updateInput) {
          fields.push(component.updateInput);
        }

        return fields;
      }, []);
  }

  @MGetter
  public get leafFields(): ReadonlyArray<LeafUpdateInput> {
    return R.filter(
      this.componentFields,
      (field) => field instanceof LeafUpdateInput,
    );
  }

  @MGetter
  public get edgeFields(): ReadonlyArray<EdgeUpdateInput> {
    return R.filter(
      this.componentFields,
      (field) => field instanceof EdgeUpdateInput,
    );
  }

  @MGetter
  public get reverseEdgeFields(): ReadonlyArray<ReverseEdgeUpdateInput> {
    return this.node.reverseEdgesByName
      .values()
      .reduce<ReverseEdgeUpdateInput[]>((fields, reverseEdge) => {
        if (reverseEdge.updateInput) {
          fields.push(reverseEdge.updateInput);
        }

        return fields;
      }, []);
  }

  @MGetter
  public get virtualFields(): ReadonlyArray<utils.Input> {
    return this.node.features.flatMap((feature) => {
      const { config, configPath } = feature.getMutationConfig(
        utils.MutationType.UPDATE,
      );

      const virtualFieldsConfig = config?.virtualFields;
      const virtualFieldsConfigPath = utils.addPath(
        configPath,
        'virtualFields',
      );

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
              if (
                this.componentFields.find(
                  (field) => field.name === virtualFieldName,
                )
              ) {
                throw new utils.UnexpectedValueError(
                  `not to have a component-field's name`,
                  virtualFieldName,
                  { path: virtualFieldsConfigPath },
                );
              } else if (
                this.reverseEdgeFields.find(
                  (field) => field.name === virtualFieldName,
                )
              ) {
                throw new utils.UnexpectedValueError(
                  `not to have a reverse-edge-field's name`,
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
    });
  }

  @MGetter
  public override get fields(): ReadonlyArray<FieldUpdateInput> {
    return [
      ...this.componentFields,
      ...this.reverseEdgeFields,
      ...this.virtualFields,
    ];
  }

  @MMethod()
  public override isPublic(): boolean {
    return (
      this.node.isPubliclyMutable(utils.MutationType.UPDATE) &&
      super.isPublic() &&
      this.componentFields.some((field) => field.isPublic())
    );
  }

  public hasComponentUpdates(
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
    components: ReadonlyArray<Component> = Array.from(this.node.componentSet),
  ): boolean {
    return this.componentFields.some(
      (field) =>
        data[field.name] !== undefined && components.includes(field.component),
    );
  }

  public async resolveUpdate(
    currentValues: ReadonlyArray<NodeValue>,
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<NodeUpdateValue> {
    const resolvedUpdate: NodeUpdateValue = Object.create(null);

    for (const field of this.leafFields) {
      const leafUpdate = data[field.name];

      if (leafUpdate !== undefined) {
        Object.assign(resolvedUpdate, { [field.name]: leafUpdate });
      }
    }

    for (const field of this.edgeFields) {
      const edgeData = data[field.name];
      const edgeUpdate =
        edgeData == null
          ? edgeData
          : await field.resolveUpdate(
              currentValues,
              edgeData,
              context,
              utils.addPath(path, field.name),
            );

      if (edgeUpdate !== undefined) {
        Object.assign(resolvedUpdate, { [field.name]: edgeUpdate });
      }
    }

    return resolvedUpdate;
  }

  public hasVirtualData(
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
    fields: ReadonlyArray<utils.Input> = this.virtualFields,
  ): boolean {
    return fields.some((field) => data[field.name] !== undefined);
  }

  public hasReverseEdgeActions(
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
    reverseEdges: ReadonlyArray<ReverseEdge> = Array.from(
      this.node.reverseEdgeSet,
    ),
  ): boolean {
    return this.reverseEdgeFields.some(
      (field) =>
        data[field.name] != null &&
        field.hasActions(data[field.name]) &&
        reverseEdges.includes(field.reverseEdge),
    );
  }

  public async applyReverseEdgeActions(
    currentValues: ReadonlyArray<NodeValue>,
    data: Readonly<NonNullable<NodeUpdateInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<void> {
    for (const field of this.reverseEdgeFields) {
      const fieldData = data[field.name];

      if (fieldData != null && field.hasActions(fieldData)) {
        await field.applyActions(
          currentValues,
          fieldData,
          context,
          utils.addPath(path, field.name),
        );
      }
    }
  }
}
