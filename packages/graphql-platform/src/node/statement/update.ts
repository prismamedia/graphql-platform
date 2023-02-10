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
    statement.getComponentUpdate(
      statement.node.getComponentByName(maybeComponentName as any),
    ),
  set: (statement, maybeComponentName, maybeComponentUpdate) => {
    statement.setComponentUpdate(
      statement.node.getComponentByName(maybeComponentName as any),
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
  public readonly path: utils.Path = utils.addPath(
    undefined,
    this.constructor.name,
  );

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
    component: Component,
    update?: ComponentUpdateValue,
  ): void {
    assert(
      this.node.componentSet.has(component),
      `The "${component}" component does not belong to the "${this.node}" node`,
    );

    update === undefined
      ? this.updatesByComponent.delete(component)
      : this.updatesByComponent.set(
          component,
          component.parseValue(
            update,
            utils.addPath(this.path, component.name),
          ),
        );
  }

  public setValue(value: NodeUpdateValue): void {
    utils.assertPlainObject(value);

    Object.entries(value).forEach(([componentName, componentValue]) =>
      this.setComponentUpdate(
        this.node.getComponentByName(componentName, this.path),
        componentValue,
      ),
    );
  }

  public getComponentUpdate(component: Component): ComponentUpdateValue {
    assert(
      this.node.componentSet.has(component),
      `The "${component}" component does not belong to the "${this.node}" node`,
    );

    return this.updatesByComponent.get(component);
  }

  public getLeafUpdate(leaf: Leaf): LeafUpdateValue {
    assert(
      this.node.componentSet.has(leaf),
      `The "${leaf}" leaf does not belong to the "${this.node}" node`,
    );

    return this.updatesByComponent.get(leaf) as any;
  }

  public getEdgeUpdate(edge: Edge): EdgeUpdateValue {
    assert(
      this.node.componentSet.has(edge),
      `The "${edge}" edge does not belong to the "${this.node}" node`,
    );

    return this.updatesByComponent.get(edge) as any;
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
