import * as utils from '@prismamedia/graphql-platform-utils';
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

export type NodeUpdateInputValue = utils.Nillable<utils.PlainObject>;

export class NodeUpdateInputType<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends utils.ObjectInputType<FieldUpdateInput> {
  public constructor(public readonly node: Node<TRequestContext, TConnector>) {
    super({
      name: `${node}UpdateInput`,
      description: `The "${node}" node's ${utils.MutationType.UPDATE}`,
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
  protected get virtualFields(): ReadonlyArray<utils.Input> {
    const { config, configPath } = this.node.getMutationConfig(
      utils.MutationType.UPDATE,
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

  public async createStatement(
    data: Readonly<utils.NonNillable<NodeUpdateInputValue>>,
    context: MutationContext,
    path: utils.Path = utils.addPath(undefined, this.name),
  ): Promise<NodeUpdate<TRequestContext, TConnector>> {
    const statement = new NodeUpdate(this.node);

    await Promise.all(
      this.componentFields.map(async (field) => {
        const fieldData = data[field.name];

        statement.setComponentUpdate(
          field.component,
          fieldData == null
            ? fieldData
            : await field.resolveComponentUpdate(
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
    data: Readonly<utils.NonNillable<NodeUpdateInputValue>>,
  ): boolean {
    return this.reverseEdgeFields.some((field) => data[field.name] != null);
  }

  public async applyReverseEdgeActions(
    nodeValue: NodeValue,
    data: Readonly<utils.NonNillable<NodeUpdateInputValue>>,
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
