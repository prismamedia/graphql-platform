import * as utils from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';

export type ComponentUpdate<TValue extends ComponentValue = any> = {
  oldValue: TValue;
  newValue: TValue;
};

export class NodeUpdate<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
> extends AbstractNodeChange<TRequestContext, TConnector, TContainer> {
  public override readonly kind = utils.MutationType.UPDATE;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: Readonly<NodeValue>;

  public readonly updatesByComponent: ReadonlyMap<
    Component<TRequestContext, TConnector, TContainer>,
    Readonly<ComponentUpdate>
  >;

  public constructor(
    node: Node<TRequestContext, TConnector, TContainer>,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    maybeNewValue: unknown,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const oldValue = Object.freeze(node.parseValue(maybeOldValue));
    const newValue = Object.freeze(node.parseValue(maybeNewValue));

    super(
      node,
      Object.freeze(node.identifier.parseValue(newValue)),
      requestContext,
      createdAt,
      committedAt,
    );

    this.oldValue = oldValue;
    this.newValue = newValue;

    this.updatesByComponent = new Map(
      Array.from(node.componentsByName.values()).reduce<
        [Component, ComponentUpdate][]
      >((entries, component) => {
        const oldComponentValue: any = oldValue[component.name];
        const newComponentValue: any = newValue[component.name];

        if (!component.areValuesEqual(oldComponentValue, newComponentValue)) {
          entries.push([
            component,
            Object.freeze({
              oldValue: oldComponentValue,
              newValue: newComponentValue,
            }),
          ]);
        }

        return entries;
      }, []),
    );
  }

  public isEmpty(): boolean {
    return this.updatesByComponent.size === 0;
  }

  public hasComponentUpdate(
    componentOrName: Component | Component['name'],
  ): boolean {
    const component = this.node.ensureComponent(componentOrName);

    return this.updatesByComponent.has(component);
  }

  public getComponentUpdate<TValue extends ComponentValue>(
    componentOrName: Component | Component['name'],
  ): ComponentUpdate<TValue> | undefined {
    const component = this.node.ensureComponent(componentOrName);

    return this.updatesByComponent.get(component);
  }
}

export const createNodeUpdateFromComponentUpdates = <
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TContainer extends object = any,
>(
  node: Node<TRequestContext, TConnector, TContainer>,
  requestContext: TRequestContext,
  maybeOldValue: NodeValue,
  updatesByComponent: Record<Component['name'], ComponentValue>,
  createdAt?: Date,
  committedAt?: Date,
): NodeUpdate<TRequestContext, TConnector, TContainer> =>
  new NodeUpdate(
    node,
    requestContext,
    maybeOldValue,
    { ...maybeOldValue, ...updatesByComponent },
    createdAt,
    committedAt,
  );
