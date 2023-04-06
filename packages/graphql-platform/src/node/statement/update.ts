import * as utils from '@prismamedia/graphql-platform-utils';
import type {
  Component,
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

const proxyHandler: ProxyHandler<NodeUpdateStatement> = {
  ownKeys: (statement) =>
    Array.from(statement.updatesByComponent.keys(), ({ name }) => name),
  has: (statement, maybeComponentName) => {
    const component = statement.node.componentsByName.get(
      maybeComponentName as any,
    );

    return component ? statement.updatesByComponent.has(component) : false;
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
      value,
    };
  },
  get: (statement, maybeComponentName) =>
    statement.getComponentUpdate(maybeComponentName as any),
  set: (statement, maybeComponentName, maybeComponentUpdate) => {
    statement.setComponentUpdate(
      maybeComponentName as any,
      maybeComponentUpdate,
    );

    return true;
  },
  deleteProperty: (statement, maybeComponentName) => {
    const component = statement.node.componentsByName.get(
      maybeComponentName as any,
    );

    return component ? statement.updatesByComponent.delete(component) : false;
  },
};

export class NodeUpdateStatement {
  readonly #path: utils.Path = utils.addPath(undefined, this.constructor.name);

  readonly #currentValue?: Readonly<NodeValue>;

  public readonly updatesByComponent = new Map<
    Component,
    utils.NonOptional<ComponentUpdateValue>
  >();

  /**
   * A convenient proxy to use this as a mutable-object
   */
  public readonly proxy: NodeUpdateValue = new Proxy(this, proxyHandler) as any;

  public constructor(
    public readonly node: Node,
    update?: Readonly<NodeUpdateValue>,
    currentValue?: Readonly<NodeValue>,
  ) {
    this.#currentValue = currentValue;
    update != null && this.setUpdate(update);
  }

  public setComponentUpdate(
    componentOrName: Component | Component['name'],
    update?: ComponentUpdateValue,
  ): void {
    const component = this.node.ensureComponent(componentOrName, this.#path);

    if (update !== undefined) {
      const parsedUpdate = component.parseValue(
        update,
        utils.addPath(this.#path, component.name),
      );

      if (
        !this.#currentValue ||
        !component.areValuesEqual(
          this.#currentValue[component.name] as any,
          parsedUpdate as any,
        )
      ) {
        this.updatesByComponent.set(component, parsedUpdate);
      } else {
        this.updatesByComponent.delete(component);
      }
    } else {
      this.updatesByComponent.delete(component);
    }
  }

  public setUpdate(value: NodeUpdateValue): void {
    utils.assertPlainObject(value);

    Object.entries(value).forEach(([componentName, componentValue]) =>
      this.setComponentUpdate(componentName, componentValue),
    );
  }

  public getComponentUpdate(
    componentOrName: Component | Component['name'],
  ): ComponentUpdateValue {
    const component = this.node.ensureComponent(componentOrName, this.#path);

    return this.updatesByComponent.get(component);
  }

  public getLeafUpdate(leafOrName: Leaf | Leaf['name']): LeafUpdateValue {
    const leaf = this.node.ensureLeaf(leafOrName, this.#path);

    return this.updatesByComponent.get(leaf) as any;
  }

  public getEdgeUpdate(edgeOrName: Edge | Edge['name']): EdgeUpdateValue {
    const edge = this.node.ensureEdge(edgeOrName, this.#path);

    return this.updatesByComponent.get(edge) as any;
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

  public individualize(currentValue: NodeValue): NodeUpdateStatement {
    return new NodeUpdateStatement(this.node, this.update, currentValue);
  }

  public isEmpty(): boolean {
    return this.updatesByComponent.size === 0;
  }
}
