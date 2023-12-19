import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  Component,
  Edge,
  Leaf,
  LeafValue,
  Node,
  ReferenceValue,
} from '../../node.js';

export type LeafCreationValue = LeafValue | undefined;

export type EdgeCreationValue = ReferenceValue | undefined;

export type ComponentCreationValue = LeafCreationValue | EdgeCreationValue;

export type NodeCreationValue = Record<
  Component['name'],
  ComponentCreationValue
>;

const proxyHandler: ProxyHandler<NodeCreationStatement> = {
  ownKeys: (statement) =>
    Array.from(statement.valuesByComponent.keys(), ({ name }) => name),
  has: (statement, componentName) => {
    const component = statement.node.componentsByName.get(componentName as any);

    return component ? statement.valuesByComponent.has(component) : false;
  },
  get: (statement, componentName) =>
    statement.getComponentValue(componentName as any),
  set: (statement, componentName, componentValue) => {
    statement.setComponentValue(componentName as any, componentValue);

    return true;
  },
  deleteProperty: (statement, componentName) => {
    const component = statement.node.componentsByName.get(componentName as any);

    return component ? statement.valuesByComponent.delete(component) : false;
  },
  getOwnPropertyDescriptor: (statement, componentName) => {
    const component = statement.node.componentsByName.get(componentName as any);
    if (!component) {
      return;
    }

    const value = statement.getComponentValue(component);
    if (value === undefined) {
      return;
    }

    return {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    };
  },
};

export class NodeCreationStatement {
  /**
   * A convenient proxy to use this as a mutable plain-object
   */
  public readonly proxy: NodeCreationValue;

  public readonly valuesByComponent = new Map<
    Component,
    utils.NonOptional<ComponentCreationValue>
  >();

  public constructor(
    public readonly node: Node,
    value?: Readonly<NodeCreationValue>,
  ) {
    value != null && this.setValue(value);

    this.proxy = new Proxy(this, proxyHandler) as any;
  }

  public setComponentValue(
    componentOrName: Component | Component['name'],
    value?: ComponentCreationValue,
  ): void {
    const component = this.node.ensureComponent(componentOrName);

    value === undefined
      ? this.valuesByComponent.delete(component)
      : this.valuesByComponent.set(
          component,
          component.selection.parseSource(value),
        );
  }

  public setValue(value: Readonly<NodeCreationValue>): void {
    utils.assertPlainObject(value);

    for (const [componentName, componentValue] of Object.entries(value)) {
      this.setComponentValue(componentName, componentValue);
    }
  }

  public getComponentValue(
    componentOrName: Component | Component['name'],
  ): ComponentCreationValue {
    return this.valuesByComponent.get(
      this.node.ensureComponent(componentOrName),
    );
  }

  public getLeafValue(leafOrName: Leaf | Leaf['name']): LeafCreationValue {
    return this.valuesByComponent.get(this.node.ensureLeaf(leafOrName)) as any;
  }

  public getEdgeValue(edgeOrName: Edge | Edge['name']): EdgeCreationValue {
    return this.valuesByComponent.get(this.node.ensureEdge(edgeOrName)) as any;
  }

  public get value(): NodeCreationValue {
    return Object.fromEntries(
      Array.from(this.valuesByComponent, ([component, value]) => [
        component.name,
        value,
      ]),
    );
  }
}
