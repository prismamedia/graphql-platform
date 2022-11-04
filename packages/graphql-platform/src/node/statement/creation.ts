import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node } from '../../node.js';
import type {
  Component,
  ComponentValue,
  EdgeValue,
  Leaf,
  LeafValue,
} from '../definition/component.js';

export type NodeCreationStatementProxy = Record<
  Component['name'],
  ComponentValue | undefined
>;

const nodeCreationProxyHandler: ProxyHandler<NodeCreationStatement> = {
  ownKeys: (creation) =>
    Array.from(creation.valuesByComponent.keys()).map(
      (component) => component.name,
    ),
  has: (creation, componentName) => {
    const component = creation.node.componentsByName.get(componentName as any);

    return component ? creation.valuesByComponent.has(component) : false;
  },
  getOwnPropertyDescriptor: (creation, componentName) => {
    const component = creation.node.componentsByName.get(componentName as any);
    if (!component) {
      return;
    }

    const componentValue = creation.valuesByComponent.get(component);
    if (componentValue === undefined) {
      return;
    }

    return {
      configurable: true,
      enumerable: true,
      value: componentValue,
    };
  },
  get: (creation, componentName) =>
    creation.valuesByComponent.get(
      creation.node.getComponentByName(componentName as any),
    ),
  set: (creation, componentName, componentValue) => {
    creation.setComponentValue(
      creation.node.getComponentByName(componentName as any),
      componentValue,
    );

    return true;
  },
  deleteProperty: (creation, componentName) => {
    creation.setComponentValue(
      creation.node.getComponentByName(componentName as any),
    );

    return true;
  },
};

export class NodeCreationStatement<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  /**
   * A convenient proxy to use this as an object
   */
  public readonly proxy: NodeCreationStatementProxy;
  readonly #valuesByComponent: Map<
    Component<TRequestContext, TConnector>,
    ComponentValue
  >;

  public constructor(public readonly node: Node<TRequestContext, TConnector>) {
    this.proxy = new Proxy(this, nodeCreationProxyHandler) as any;
    this.#valuesByComponent = new Map();
  }

  public get valuesByComponent(): ReadonlyMap<
    Component<TRequestContext, TConnector>,
    ComponentValue
  > {
    return this.#valuesByComponent;
  }

  public getComponentValue<TComponent extends Component>(
    component: TComponent,
  ): (TComponent extends Leaf ? LeafValue : EdgeValue) | undefined {
    return this.#valuesByComponent.get(component) as any;
  }

  public setComponentValue(component: Component, value?: ComponentValue): void {
    value === undefined
      ? this.#valuesByComponent.delete(component)
      : this.#valuesByComponent.set(component, component.parseValue(value));
  }
}
