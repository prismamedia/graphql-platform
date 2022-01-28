import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type {
  Component,
  ComponentValue,
  Edge,
  EdgeValue,
  Leaf,
  LeafValue,
} from '../definition/component.js';

export type NodeCreationProxy = Record<Component['name'], ComponentValue>;

const nodeCreationProxyHandler: ProxyHandler<NodeCreation> = {
  ownKeys: (creation) =>
    Array.from(creation.valuesByComponent.keys()).map(
      (component) => component.name,
    ),
  has: (creation, componentName) => {
    const component = creation.node.componentsByName.get(componentName as any);

    return component ? creation.valuesByComponent.has(component) : false;
  },
  getOwnPropertyDescriptor: (creation, componentName) => {
    const component = creation.node.componentsByName.get(componentName as any);
    if (!component) {
      return;
    }

    const componentValue = creation.valuesByComponent.get(component);
    if (componentValue === undefined) {
      return;
    }

    return {
      configurable: true,
      enumerable: true,
      value: componentValue,
    };
  },
  get: (creation, componentName) =>
    creation.valuesByComponent.get(
      creation.node.getComponent(componentName as any),
    ),
  set: (creation, componentName, componentValue) => {
    creation.setComponentValue(
      creation.node.getComponent(componentName as any),
      componentValue,
    );

    return true;
  },
  deleteProperty: (creation, componentName) => {
    creation.setComponentValue(
      creation.node.getComponent(componentName as any),
    );

    return true;
  },
};

export class NodeCreation<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  /**
   * A convenient proxy to use this as an object
   */
  public readonly proxy: NodeCreationProxy;
  readonly #valuesByComponent: Map<
    Component<TRequestContext, TConnector>,
    ComponentValue
  >;

  public constructor(public readonly node: Node<TRequestContext, TConnector>) {
    this.proxy = new Proxy(this, nodeCreationProxyHandler) as any;
    this.#valuesByComponent = new Map();
  }

  public get valuesByComponent(): ReadonlyMap<
    Component<TRequestContext, TConnector>,
    ComponentValue
  > {
    return this.#valuesByComponent;
  }

  public get valuesByLeaf(): ReadonlyMap<
    Leaf<TRequestContext, TConnector>,
    LeafValue
  > {
    return new Map(
      Array.from(this.#valuesByComponent).filter(
        (entry): entry is [Leaf<TRequestContext, TConnector>, LeafValue] =>
          entry[0].kind === 'Leaf',
      ),
    );
  }

  public get valuesByEdge(): ReadonlyMap<
    Edge<TRequestContext, TConnector>,
    EdgeValue
  > {
    return new Map(
      Array.from(this.#valuesByComponent).filter(
        (entry): entry is [Edge<TRequestContext, TConnector>, EdgeValue] =>
          entry[0].kind === 'Edge',
      ),
    );
  }

  public setComponentValue(
    component: Component<TRequestContext, TConnector>,
    value?: ComponentValue,
  ): void {
    value === undefined
      ? this.#valuesByComponent.delete(component)
      : this.#valuesByComponent.set(component, component.parseValue(value));
  }

  public setLeafValue(
    leaf: Leaf<TRequestContext, TConnector>,
    value?: LeafValue,
  ): void {
    assert.equal(leaf.kind, 'Leaf');

    return this.setComponentValue(leaf, value);
  }

  public setEdgeValue(
    edge: Edge<TRequestContext, TConnector>,
    value?: EdgeValue,
  ): void {
    assert.equal(edge.kind, 'Edge');

    return this.setComponentValue(edge, value);
  }
}
