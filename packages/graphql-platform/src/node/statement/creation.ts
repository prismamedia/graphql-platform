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

export type LeafCreationValue = LeafValue | undefined;

export type EdgeCreationValue = EdgeValue | undefined;

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

    const value = statement.valuesByComponent.get(component);
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

  public constructor(public readonly node: Node, value?: NodeCreationValue) {
    value != null && this.setValue(value);
  }

  public setComponentValue(
    componentOrName: Component | Component['name'],
    value?: ComponentCreationValue,
  ): void {
    const component = this.node.ensureComponentOrName(componentOrName);

    value === undefined
      ? this.valuesByComponent.delete(component)
      : this.valuesByComponent.set(component, component.parseValue(value));
  }

  public setValue(value: NodeCreationValue): void {
    assert(utils.isPlainObject(value), `Expects a plain-object`);

    Object.entries(value).forEach(([componentName, componentValue]) =>
      this.setComponentValue(componentName, componentValue),
    );
  }

  public getComponentValue(
    componentOrName: Component | Component['name'],
  ): ComponentCreationValue {
    return this.valuesByComponent.get(
      this.node.ensureComponentOrName(componentOrName),
    );
  }

  public getLeafValue(leafOrName: Leaf | Leaf['name']): LeafCreationValue {
    return this.valuesByComponent.get(
      this.node.ensureLeafOrName(leafOrName),
    ) as any;
  }

  public getEdgeValue(edgeOrName: Edge | Edge['name']): EdgeCreationValue {
    return this.valuesByComponent.get(
      this.node.ensureEdgeOrName(edgeOrName),
    ) as any;
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

  public clone(): NodeCreationStatement {
    return new NodeCreationStatement(this.node, this.value);
  }
}
