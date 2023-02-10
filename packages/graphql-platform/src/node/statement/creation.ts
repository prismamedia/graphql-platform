import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
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
    statement.getComponentValue(
      statement.node.getComponentByName(
        maybeComponentName as any,
        utils.addPath(
          utils.addPath(undefined, 'NodeCreationStatement'),
          String(maybeComponentName),
        ),
      ),
    ),
  set: (statement, maybeComponentName, maybeComponentValue) => {
    statement.setComponentValue(
      statement.node.getComponentByName(
        maybeComponentName as any,
        utils.addPath(
          utils.addPath(undefined, 'NodeCreationStatement'),
          String(maybeComponentName),
        ),
      ),
      maybeComponentValue,
    );

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
  public readonly path: utils.Path = utils.addPath(
    undefined,
    this.constructor.name,
  );

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
    component: Component,
    value?: ComponentCreationValue,
  ): void {
    assert(
      this.node.componentSet.has(component),
      `The "${component}" component does not belong to the "${this.node}" node`,
    );

    value === undefined
      ? this.valuesByComponent.delete(component)
      : this.valuesByComponent.set(
          component,
          component.parseValue(value, utils.addPath(this.path, component.name)),
        );
  }

  public setValue(value: NodeCreationValue): void {
    utils.assertPlainObject(value);

    Object.entries(value).forEach(([componentName, componentValue]) =>
      this.setComponentValue(
        this.node.getComponentByName(componentName, this.path),
        componentValue,
      ),
    );
  }

  public getComponentValue(component: Component): ComponentCreationValue {
    assert(
      this.node.componentSet.has(component),
      `The "${component}" component does not belong to the "${this.node}" node`,
    );

    return this.valuesByComponent.get(component);
  }

  public getLeafValue(leaf: Leaf): LeafCreationValue {
    assert(
      this.node.componentSet.has(leaf),
      `The "${leaf}" leaf does not belong to the "${this.node}" node`,
    );

    return this.valuesByComponent.get(leaf) as any;
  }

  public getEdgeValue(edge: Edge): EdgeCreationValue {
    assert(
      this.node.componentSet.has(edge),
      `The "${edge}" edge does not belong to the "${this.node}" node`,
    );

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

  public clone(): NodeCreationStatement {
    return new NodeCreationStatement(this.node, this.value);
  }
}
