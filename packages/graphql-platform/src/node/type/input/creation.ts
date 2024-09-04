import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import assert from 'node:assert/strict';
import type { Except } from 'type-fest';
import type { Edge, Node, NodeValue, ReverseEdge } from '../../../node.js';
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
  readonly #excludedEdge?: Edge;

  public constructor(
    public readonly node: Node,
    excludedEdge?: Edge,
  ) {
    excludedEdge && node.ensureEdge(excludedEdge);
    assert(node.isCreatable(), `The "${node}" node is not creatable`);

    super({
      name: [
        node.name,
        inflection.camelize(utils.MutationType.CREATION),
        excludedEdge
          ? `Without${inflection.camelize(excludedEdge.name)}`
          : undefined,
        'Input',
      ]
        .filter(Boolean)
        .join(''),
      description: `The "${node}" node's ${utils.MutationType.CREATION}`,
    });

    this.#excludedEdge = excludedEdge;
  }

  @Memoize()
  protected get componentFields(): ReadonlyArray<ComponentCreationInput> {
    return Array.from(this.node.componentsByName.values()).reduce<
      ComponentCreationInput[]
    >((fields, component) => {
      if (component !== this.#excludedEdge) {
        fields.push(component.creationInput);
      }

      return fields;
    }, []);
  }

  @Memoize()
  protected get reverseEdgeFields(): ReadonlyArray<ReverseEdgeCreationInput> {
    return Array.from(this.node.reverseEdgesByName.values()).reduce<
      ReverseEdgeCreationInput[]
    >((fields, reverseEdge) => {
      if (reverseEdge.creationInput) {
        fields.push(reverseEdge.creationInput);
      }

      return fields;
    }, []);
  }

  @Memoize()
  protected get virtualFields(): ReadonlyArray<utils.Input> {
    return this.node.features.flatMap((feature) => {
      const { config, configPath } = feature.getMutationConfig(
        utils.MutationType.CREATION,
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
      this.node.isPubliclyMutable(utils.MutationType.CREATION) &&
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

    for (const field of this.componentFields) {
      const fieldData = data[field.name];

      const componentValue =
        fieldData == null || field instanceof LeafCreationInput
          ? fieldData
          : await field.resolveValue(
              fieldData,
              context,
              utils.addPath(path, field.name),
            );

      if (componentValue !== undefined) {
        Object.assign(resolvedValue, { [field.name]: componentValue });
      }
    }

    return resolvedValue;
  }

  public hasReverseEdgeActions(
    data: Readonly<NonNullable<NodeCreationInputValue>>,
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
    nodeValue: Readonly<NodeValue>,
    data: Readonly<NonNullable<NodeCreationInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<void> {
    for (const field of this.reverseEdgeFields) {
      const fieldData = data[field.name];

      if (fieldData != null && field.hasActions(fieldData)) {
        await field.applyActions(
          nodeValue,
          fieldData,
          context,
          utils.addPath(path, field.name),
        );
      }
    }
  }
}
