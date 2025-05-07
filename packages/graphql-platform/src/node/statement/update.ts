import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  Component,
  ComponentValue,
  Edge,
  Leaf,
  LeafValue,
  Node,
  NodeValue,
  ReferenceValue,
} from '../../node.js';

export type LeafUpdateValue = LeafValue | undefined;

export type EdgeUpdateValue = ReferenceValue | undefined;

export type ComponentUpdateValue = LeafUpdateValue | EdgeUpdateValue;

export type NodeUpdateValue = Record<Component['name'], ComponentUpdateValue>;

const updateProxyHandler: ProxyHandler<NodeUpdateStatement> = {
  ownKeys: (statement) =>
    Array.from(statement.updatesByComponent.keys(), ({ name }) => name),
  has: (statement, componentName) => {
    const component = statement.node.componentsByName.get(componentName as any);

    return component ? statement.updatesByComponent.has(component) : false;
  },
  get: (statement, componentName) =>
    statement.getComponentUpdate(componentName as any),
  set: (statement, componentName, componentUpdate) => {
    statement.setComponentUpdate(componentName as any, componentUpdate);

    return true;
  },
  deleteProperty: (statement, componentName) => {
    const component = statement.node.componentsByName.get(componentName as any);

    return component ? statement.updatesByComponent.delete(component) : false;
  },
  getOwnPropertyDescriptor: (statement, componentName) => {
    const component = statement.node.componentsByName.get(componentName as any);
    if (!component) {
      return;
    }

    const value = statement.getComponentUpdate(component);
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

const targetProxyHandler: ProxyHandler<NodeUpdateStatement> = {
  ownKeys: (statement) => Array.from(statement.node.componentsByName.keys()),
  has: (statement, componentName) =>
    statement.node.componentsByName.has(componentName as any),
  get: (statement, componentName) =>
    statement.getComponentTarget(componentName as any),
  set: (statement, componentName, componentUpdate) => {
    statement.setComponentUpdate(componentName as any, componentUpdate);

    return true;
  },
  deleteProperty: (_statement, componentName) => {
    throw new TypeError(`Cannot delete property "${String(componentName)}"`);
  },
  getOwnPropertyDescriptor: (statement, componentName) => {
    const component = statement.node.componentsByName.get(componentName as any);

    return component
      ? {
          configurable: true,
          enumerable: true,
          writable: true,
          value: statement.getComponentTarget(component),
        }
      : undefined;
  },
};

export class NodeUpdateStatement {
  public readonly updatesByComponent: Map<
    Component,
    utils.NonOptional<ComponentUpdateValue>
  >;

  /**
   * A convenient way to access the updates of this node, as a mutable plain-object
   */
  public readonly updateProxy: NodeUpdateValue;

  /**
   * A convenient way to access the targeted value of this node, as a mutable plain-object
   */
  public readonly targetProxy: NodeValue;

  public constructor(
    public readonly node: Node,
    public readonly current: Readonly<NodeValue>,
    update?: Readonly<NodeUpdateValue>,
  ) {
    this.updatesByComponent = new Map();
    update != null && this.setUpdate(update);

    this.updateProxy = new Proxy(this, updateProxyHandler) as any;
    this.targetProxy = new Proxy(this, targetProxyHandler) as any;
  }

  public setComponentUpdate(
    componentOrName: Component | Component['name'],
    rawUpdate?: ComponentUpdateValue,
  ): void {
    const component = this.node.ensureComponent(componentOrName);

    if (rawUpdate === undefined) {
      this.updatesByComponent.delete(component);
    } else {
      const update = component.selection.parseSource(rawUpdate);

      if (
        component.selection.areValuesEqual(
          this.current[component.name] as any,
          update as any,
        )
      ) {
        this.updatesByComponent.delete(component);
      } else {
        this.updatesByComponent.set(component, update);
      }
    }
  }

  public setUpdate(value: Readonly<NodeUpdateValue>): void {
    utils.assertPlainObject(value);

    for (const [componentName, componentValue] of Object.entries(value)) {
      this.setComponentUpdate(componentName, componentValue);
    }
  }

  public getComponentUpdate(
    componentOrName: Component | Component['name'],
  ): ComponentUpdateValue {
    return this.updatesByComponent.get(
      this.node.ensureComponent(componentOrName),
    );
  }

  public getLeafUpdate(leafOrName: Leaf | Leaf['name']): LeafUpdateValue {
    return this.updatesByComponent.get(this.node.ensureLeaf(leafOrName)) as any;
  }

  public getEdgeUpdate(edgeOrName: Edge | Edge['name']): EdgeUpdateValue {
    return this.updatesByComponent.get(this.node.ensureEdge(edgeOrName)) as any;
  }

  public get update(): NodeUpdateValue {
    return this.updatesByComponent
      .entries()
      .reduce<NodeUpdateValue>(
        (update, [component, componentUpdate]) =>
          Object.assign(update, { [component.name]: componentUpdate }),
        Object.create(null),
      );
  }

  public isEmpty(): boolean {
    return this.updatesByComponent.size === 0;
  }

  public getComponentTarget(
    componentOrName: Component | Component['name'],
  ): ComponentValue {
    const component = this.node.ensureComponent(componentOrName);
    const componentUpdate = this.updatesByComponent.get(component);

    return componentUpdate === undefined
      ? this.current[component.name]
      : componentUpdate;
  }

  public getLeafTarget(leafOrName: Leaf | Leaf['name']): LeafValue {
    return this.getComponentTarget(this.node.ensureLeaf(leafOrName)) as any;
  }

  public getEdgeTarget(edgeOrName: Edge | Edge['name']): ReferenceValue {
    return this.getComponentTarget(this.node.ensureEdge(edgeOrName)) as any;
  }

  public get target(): NodeValue {
    return this.node.componentSet.values().reduce<NodeValue>(
      (target, component) =>
        Object.assign(target, {
          [component.name]: this.getComponentTarget(component),
        }),
      Object.create(null),
    );
  }
}
