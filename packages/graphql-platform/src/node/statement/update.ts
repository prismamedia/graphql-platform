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

export class NodeUpdateStatement {
  /**
   * A convenient proxy to use this as a mutable plain-object
   */
  public readonly updateProxy: NodeUpdateValue;

  public readonly updatesByComponent = new Map<
    Component,
    utils.NonOptional<ComponentUpdateValue>
  >();

  public constructor(
    public readonly node: Node,
    update?: Readonly<NodeUpdateValue>,
    protected readonly currentValue?: Readonly<NodeValue>,
  ) {
    update != null && this.setUpdate(update);

    this.updateProxy = new Proxy(this, updateProxyHandler) as any;
  }

  public setComponentUpdate(
    componentOrName: Component | Component['name'],
    update?: ComponentUpdateValue,
  ): void {
    const component = this.node.ensureComponent(componentOrName);

    if (update === undefined) {
      this.updatesByComponent.delete(component);
    } else {
      const value = component.parseValue(update);

      if (
        this.currentValue &&
        component.areValuesEqual(
          this.currentValue[component.name] as any,
          value as any,
        )
      ) {
        this.updatesByComponent.delete(component);
      } else {
        this.updatesByComponent.set(component, value);
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
    return Object.fromEntries(
      Array.from(this.updatesByComponent, ([component, update]) => [
        component.name,
        update,
      ]),
    );
  }

  public isEmpty(): boolean {
    return this.updatesByComponent.size === 0;
  }

  public individualize(
    currentValue: Readonly<NodeValue>,
  ): IndividualizedNodeUpdateStatement {
    return new IndividualizedNodeUpdateStatement(
      this.node,
      this.update,
      currentValue,
    );
  }
}

const updatedValueProxyHandler: ProxyHandler<IndividualizedNodeUpdateStatement> =
  {
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
      const component = statement.node.componentsByName.get(
        componentName as any,
      );

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

export class IndividualizedNodeUpdateStatement extends NodeUpdateStatement {
  public readonly targetProxy: NodeValue;

  public constructor(
    node: Node,
    update: Readonly<NodeUpdateValue> | undefined,
    protected override readonly currentValue: Readonly<NodeValue>,
  ) {
    super(node, update, currentValue);

    this.targetProxy = new Proxy(this, updatedValueProxyHandler) as any;
  }

  public getComponentTarget(
    componentOrName: Component | Component['name'],
  ): ComponentValue {
    const component = this.node.ensureComponent(componentOrName);
    const componentUpdate = this.updatesByComponent.get(component);

    return componentUpdate === undefined
      ? this.currentValue[component.name]
      : componentUpdate;
  }

  public get target(): NodeValue {
    return Object.fromEntries(
      Array.from(this.node.componentsByName.values(), (component) => [
        component.name,
        this.getComponentTarget(component),
      ]),
    );
  }
}
