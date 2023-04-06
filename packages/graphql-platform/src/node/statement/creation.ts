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
  has: (statement, maybeComponentName) => {
    const component = statement.node.componentsByName.get(
      maybeComponentName as any,
    );

    return component ? statement.valuesByComponent.has(component) : false;
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
      value,
    };
  },
  get: (statement, maybeComponentName) =>
    statement.getComponentValue(maybeComponentName as any),
  set: (statement, maybeComponentName, maybeComponentValue) => {
    statement.setComponentValue(maybeComponentName as any, maybeComponentValue);

    return true;
  },
  deleteProperty: (statement, maybeComponentName) => {
    const component = statement.node.componentsByName.get(
      maybeComponentName as any,
    );

    return component ? statement.valuesByComponent.delete(component) : false;
  },
};

export class NodeCreationStatement {
  readonly #path: utils.Path = utils.addPath(undefined, this.constructor.name);

  public readonly valuesByComponent = new Map<
    Component,
    utils.NonOptional<ComponentCreationValue>
  >();

  /**
   * A convenient proxy to use this as a mutable-object
   */
  public readonly proxy: NodeCreationValue = new Proxy(
    this,
    proxyHandler,
  ) as any;

  public constructor(
    public readonly node: Node,
    value?: Readonly<NodeCreationValue>,
  ) {
    value != null && this.setValue(value);
  }

  public setComponentValue(
    componentOrName: Component | Component['name'],
    value?: ComponentCreationValue,
  ): void {
    const component = this.node.ensureComponent(componentOrName, this.#path);

    value === undefined
      ? this.valuesByComponent.delete(component)
      : this.valuesByComponent.set(
          component,
          component.parseValue(
            value,
            utils.addPath(this.#path, component.name),
          ),
        );
  }

  public setValue(value: Readonly<NodeCreationValue>): void {
    utils.assertPlainObject(value);

    Object.entries(value).forEach(([componentName, componentValue]) =>
      this.setComponentValue(componentName, componentValue),
    );
  }

  public getComponentValue(
    componentOrName: Component | Component['name'],
  ): ComponentCreationValue {
    const component = this.node.ensureComponent(componentOrName, this.#path);

    return this.valuesByComponent.get(component);
  }

  public getLeafValue(leafOrName: Leaf | Leaf['name']): LeafCreationValue {
    const leaf = this.node.ensureLeaf(leafOrName, this.#path);

    return this.valuesByComponent.get(leaf) as any;
  }

  public getEdgeValue(edgeOrName: Edge | Edge['name']): EdgeCreationValue {
    const edge = this.node.ensureEdge(edgeOrName, this.#path);

    return this.valuesByComponent.get(edge) as any;
  }

  public get value(): NodeCreationValue {
    return Object.assign(
      Object.create(null),
      Object.fromEntries(
        Array.from(this.valuesByComponent, ([component, value]) => [
          component.name,
          value,
        ]),
      ),
    );
  }
}
