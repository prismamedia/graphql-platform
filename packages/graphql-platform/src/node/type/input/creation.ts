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
import { OperationError } from '../../operation/error.js';
import type {
  ComponentCreationValue,
  NodeCreationValue,
} from '../../statement/creation.js';
import {
  type ComponentCreationInput,
  EdgeCreationInput,
  type FieldCreationInput,
  LeafCreationInput,
  type ReverseEdgeCreationInput,
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

  @MGetter
  public get componentFields(): ReadonlyArray<ComponentCreationInput> {
    return this.node.componentsByName
      .values()
      .reduce<ComponentCreationInput[]>((fields, component) => {
        if (component !== this.#excludedEdge) {
          fields.push(component.creationInput);
        }

        return fields;
      }, []);
  }

  @MGetter
  public get leafFields(): ReadonlyArray<LeafCreationInput> {
    return R.filter(
      this.componentFields,
      (field) => field instanceof LeafCreationInput,
    );
  }

  @MGetter
  public get edgeFields(): ReadonlyArray<EdgeCreationInput> {
    return R.filter(
      this.componentFields,
      (field) => field instanceof EdgeCreationInput,
    );
  }

  @MGetter
  public get reverseEdgeFields(): ReadonlyArray<ReverseEdgeCreationInput> {
    return this.node.reverseEdgesByName
      .values()
      .reduce<ReverseEdgeCreationInput[]>((fields, reverseEdge) => {
        if (reverseEdge.creationInput) {
          fields.push(reverseEdge.creationInput);
        }

        return fields;
      }, []);
  }

  @MGetter
  public get virtualFields(): ReadonlyArray<utils.Input> {
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

  @MGetter
  public override get fields(): ReadonlyArray<FieldCreationInput> {
    return [
      ...this.componentFields,
      ...this.reverseEdgeFields,
      ...this.virtualFields,
    ];
  }

  @MMethod()
  public override isPublic(): boolean {
    return (
      this.node.isPubliclyMutable(utils.MutationType.CREATION) &&
      super.isPublic() &&
      this.componentFields.some((field) => field.isPublic())
    );
  }

  public hasComponentValues(
    data: Readonly<NonNullable<NodeCreationInputValue>>,
    components: ReadonlyArray<Component> = Array.from(this.node.componentSet),
  ): boolean {
    return this.componentFields.some(
      (field) =>
        data[field.name] !== undefined && components.includes(field.component),
    );
  }

  public async resolveValue(
    data: Readonly<NonNullable<NodeCreationInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<NodeCreationValue> {
    const resolvedValue: NodeCreationValue = Object.create(null);

    for (const field of this.leafFields) {
      const leafValue = data[field.name];
      if (leafValue !== undefined) {
        Object.assign(resolvedValue, { [field.name]: leafValue });
      }
    }

    for (const field of this.edgeFields) {
      const edgeData = data[field.name];

      let edgeValue: ComponentCreationValue;
      try {
        edgeValue =
          edgeData == null
            ? edgeData
            : await field.resolveValue(
                edgeData,
                context,
                utils.addPath(path, field.name),
              );
      } catch (cause) {
        throw new OperationError(context.request, this.node, {
          reason: `resolving the "${field.name}" edge's value`,
          mutatedValue: resolvedValue,
          mutationType: utils.MutationType.CREATION,
          cause,
          path,
        });
      }

      if (edgeValue !== undefined) {
        Object.assign(resolvedValue, { [field.name]: edgeValue });
      }
    }

    return resolvedValue;
  }

  public hasVirtualData(
    data: Readonly<NonNullable<NodeCreationInputValue>>,
    fields: ReadonlyArray<utils.Input> = this.virtualFields,
  ): boolean {
    return fields.some((field) => data[field.name] !== undefined);
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
    currentValue: Readonly<NodeValue>,
    data: Readonly<NonNullable<NodeCreationInputValue>>,
    context: MutationContext,
    path?: utils.Path,
  ): Promise<void> {
    for (const field of this.reverseEdgeFields) {
      const fieldData = data[field.name];

      if (fieldData != null && field.hasActions(fieldData)) {
        try {
          await field.applyActions(
            currentValue,
            fieldData,
            context,
            utils.addPath(path, field.name),
          );
        } catch (cause) {
          throw new OperationError(context.request, this.node, {
            reason: `applying the "${field.name}" reverse-edge's action(s)`,
            mutatedValue: currentValue,
            mutationType: utils.MutationType.CREATION,
            cause,
            path,
          });
        }
      }
    }
  }
}
