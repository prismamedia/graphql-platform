import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type { Component, ComponentUpdate } from '../definition/component.js';

export type NodeUpdateProxy = Record<Component['name'], ComponentUpdate>;

const nodeUpdateProxyHandler: ProxyHandler<NodeUpdate> = {
  ownKeys: (update) =>
    Array.from(update.updatesByComponent.keys()).map(
      (component) => component.name,
    ),
  has: (update, componentName) => {
    const component = update.node.componentsByName.get(componentName as any);

    return component ? update.updatesByComponent.has(component) : false;
  },
  getOwnPropertyDescriptor: (update, componentName) => {
    const component = update.node.componentsByName.get(componentName as any);
    if (!component) {
      return;
    }

    const componentUpdate = update.updatesByComponent.get(component);
    if (componentUpdate === undefined) {
      return;
    }

    return {
      configurable: true,
      enumerable: true,
      value: componentUpdate,
    };
  },
  get: (update, componentName) =>
    update.updatesByComponent.get(
      update.node.getComponentByName(componentName as any),
    ),
  set: (update, componentName, componentUpdate) => {
    update.setComponentUpdate(
      update.node.getComponentByName(componentName as any),
      componentUpdate,
    );

    return true;
  },
  deleteProperty: (update, componentName) => {
    update.setComponentUpdate(
      update.node.getComponentByName(componentName as any),
    );

    return true;
  },
};

export class NodeUpdate<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  /**
   * A convenient proxy to use this as an object
   */
  public readonly proxy: NodeUpdateProxy;
  readonly #updatesByComponent: Map<
    Component<TRequestContext, TConnector>,
    ComponentUpdate
  >;

  public constructor(public readonly node: Node<TRequestContext, TConnector>) {
    this.proxy = new Proxy(this, nodeUpdateProxyHandler) as any;
    this.#updatesByComponent = new Map();
  }

  public get updatesByComponent(): ReadonlyMap<
    Component<TRequestContext, TConnector>,
    ComponentUpdate
  > {
    return this.#updatesByComponent;
  }

  public setComponentUpdate(
    component: Component<TRequestContext, TConnector>,
    update?: ComponentUpdate,
  ): void {
    update === undefined
      ? this.#updatesByComponent.delete(component)
      : this.#updatesByComponent.set(component, component.parseUpdate(update));
  }

  public clone(): NodeUpdate<TRequestContext, TConnector> {
    const clone = new NodeUpdate(this.node);

    this.#updatesByComponent.forEach((update, component) =>
      clone.setComponentUpdate(component, update),
    );

    return clone;
  }
}
