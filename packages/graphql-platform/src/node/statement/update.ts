import * as utils from '@prismamedia/graphql-platform-utils';
import * as R from 'remeda';
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

export interface ComponentFilterOptions {
  include?: ReadonlyArray<Component | Component['name']>;
  exclude?: ReadonlyArray<Component | Component['name']>;
}

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
  readonly #currentValue: Readonly<NodeValue>;

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
    currentValue: Readonly<NodeValue>,
    update?: Readonly<NodeUpdateValue>,
  ) {
    this.#currentValue = currentValue;
    this.updatesByComponent = new Map();
    update != null && this.setUpdate(update);

    this.updateProxy = new Proxy(this, updateProxyHandler) as any;
    this.targetProxy = new Proxy(this, targetProxyHandler) as any;
  }

  public setComponentUpdate(
    componentOrName: Component | Component['name'],
    update?: ComponentUpdateValue,
  ): void {
    const component = this.node.ensureComponent(componentOrName);

    update === undefined
      ? this.updatesByComponent.delete(component)
      : this.updatesByComponent.set(
          component,
          component.selection.parseSource(update),
        );
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
    return Object.assign(
      Object.create(null),
      Object.fromEntries(
        Array.from(this.updatesByComponent, ([component, update]) => [
          component.name,
          update,
        ]),
      ),
    );
  }

  public getActualUpdatesByComponent(
    options?: ComponentFilterOptions,
  ): Map<Component, ComponentUpdateValue> {
    return new Map(
      R.pipe(
        Array.from(this.updatesByComponent),
        options?.include == null
          ? R.identity()
          : R.intersectionWith(
              options.include.map((componentOrName) =>
                this.node.ensureComponent(componentOrName),
              ),
              ([a], b) => a === b,
            ),
        options?.exclude == null
          ? R.identity()
          : R.differenceWith(
              options.exclude.map((componentOrName) =>
                this.node.ensureComponent(componentOrName),
              ),
              ([a], b) => a === b,
            ),
        R.filter(
          ([component, update]) =>
            !component.selection.areValuesEqual(
              this.#currentValue[component.name] as any,
              update as any,
            ),
        ),
      ),
    );
  }

  public getActualUpdate(options?: ComponentFilterOptions): NodeUpdateValue {
    return Object.assign(
      Object.create(null),
      Object.fromEntries(
        Array.from(
          this.getActualUpdatesByComponent(options),
          ([component, update]) => [component.name, update],
        ),
      ),
    );
  }

  public hasActualComponentUpdate(options?: ComponentFilterOptions): boolean {
    return this.getActualUpdatesByComponent(options).size > 0;
  }

  public getComponentTarget(
    componentOrName: Component | Component['name'],
  ): ComponentValue {
    const component = this.node.ensureComponent(componentOrName);
    const componentUpdate = this.updatesByComponent.get(component);

    return componentUpdate === undefined
      ? this.#currentValue[component.name]
      : componentUpdate;
  }

  public getLeafTarget(leafOrName: Leaf | Leaf['name']): LeafValue {
    return this.getComponentTarget(this.node.ensureLeaf(leafOrName)) as any;
  }

  public getEdgeTarget(edgeOrName: Edge | Edge['name']): ReferenceValue {
    return this.getComponentTarget(this.node.ensureEdge(edgeOrName)) as any;
  }

  public get target(): NodeValue {
    return Object.assign(
      Object.create(null),
      Object.fromEntries(
        Array.from(this.node.componentSet, (component) => [
          component.name,
          this.getComponentTarget(component),
        ]),
      ),
    );
  }
}
