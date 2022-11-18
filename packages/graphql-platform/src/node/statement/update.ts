import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import type {
  Component,
  Edge,
  EdgeValue,
  Leaf,
  LeafValue,
  Node,
} from '../../node.js';

export type LeafUpdateValue = LeafValue | undefined;

export type EdgeUpdateValue = EdgeValue | undefined;

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

    const value = statement.updatesByComponent.get(component);
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
  public readonly updatesByComponent = new Map<
    Component,
    utils.NonOptional<ComponentUpdateValue>
  >();

  /**
   * A convenient proxy to use this as a mutable-object
   */
  public readonly proxy: NodeUpdateValue = new Proxy(this, proxyHandler) as any;

  public constructor(public readonly node: Node, value?: NodeUpdateValue) {
    value != null && this.setValue(value);
  }

  public setComponentUpdate(
    componentOrName: Component | Component['name'],
    update?: ComponentUpdateValue,
  ): void {
    const component = this.node.ensureComponentOrName(componentOrName);

    update === undefined
      ? this.updatesByComponent.delete(component)
      : this.updatesByComponent.set(component, component.parseValue(update));
  }

  public setValue(value: NodeUpdateValue): void {
    assert(utils.isPlainObject(value), `Expects a plain-object`);

    Object.entries(value).forEach(([componentName, componentValue]) =>
      this.setComponentUpdate(componentName, componentValue),
    );
  }

  public getComponentUpdate(
    componentOrName: Component | Component['name'],
  ): ComponentUpdateValue {
    return this.updatesByComponent.get(
      this.node.ensureComponentOrName(componentOrName),
    );
  }

  public getLeafUpdate(leafOrName: Leaf | Leaf['name']): LeafUpdateValue {
    return this.updatesByComponent.get(
      this.node.ensureLeafOrName(leafOrName),
    ) as any;
  }

  public getEdgeUpdate(edgeOrName: Edge | Edge['name']): EdgeUpdateValue {
    return this.updatesByComponent.get(
      this.node.ensureEdgeOrName(edgeOrName),
    ) as any;
  }

  public get value(): NodeUpdateValue {
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

  public clone(): NodeUpdateStatement {
    return new NodeUpdateStatement(this.node, this.value);
  }
}
