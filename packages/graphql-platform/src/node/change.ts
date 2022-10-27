import { MutationType } from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Component, ComponentValue, Node, NodeValue } from '../node.js';

abstract class AbstractChangedNode<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  public abstract readonly kind: MutationType;
  #at: Date;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly requestContext: TRequestContext,
    at: Date = new Date(),
  ) {
    this.#at = at;
  }

  public commit(at: Date = new Date()): void {
    this.#at = at;
  }

  public get at(): Date {
    return this.#at;
  }
}

export class CreatedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractChangedNode<TRequestContext, TConnector> {
  public override readonly kind = MutationType.CREATION;

  public readonly oldValue: undefined;
  public readonly newValue: Readonly<NodeValue>;

  public constructor(
    node: Node<TRequestContext, TConnector>,
    requestContext: TRequestContext,
    maybeNewValue: unknown,
    at?: Date,
  ) {
    super(node, requestContext, at);

    this.newValue = Object.freeze(node.parseValue(maybeNewValue));
  }
}

export class DeletedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractChangedNode<TRequestContext, TConnector> {
  public override readonly kind = MutationType.DELETION;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: undefined;

  public constructor(
    node: Node<TRequestContext, TConnector>,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    at?: Date,
  ) {
    super(node, requestContext, at);

    this.oldValue = Object.freeze(node.parseValue(maybeOldValue));
  }
}

export class UpdatedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractChangedNode<TRequestContext, TConnector> {
  public override readonly kind = MutationType.UPDATE;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: Readonly<NodeValue>;

  public readonly updatesByComponent: ReadonlyMap<
    Component<TRequestContext, TConnector>,
    Readonly<{ oldValue: ComponentValue; newValue: ComponentValue }>
  >;

  public readonly updatedComponentNames: ReadonlyArray<Component['name']>;

  public constructor(
    node: Node<TRequestContext, TConnector>,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    maybeNewValue: unknown,
    at?: Date,
  ) {
    super(node, requestContext, at);

    this.oldValue = Object.freeze(node.parseValue(maybeOldValue));
    this.newValue = Object.freeze(node.parseValue(maybeNewValue));

    this.updatesByComponent = new Map(
      Array.from(node.componentsByName.values()).reduce<
        [
          Component,
          Readonly<{ oldValue: ComponentValue; newValue: ComponentValue }>,
        ][]
      >((entries, component) => {
        const oldComponentValue: any = this.oldValue[component.name];
        const newComponentValue: any = this.newValue[component.name];

        if (!component.areValuesEqual(oldComponentValue, newComponentValue)) {
          entries.push([
            component,
            Object.freeze({
              oldValue: oldComponentValue,
              newValue: newComponentValue,
            }),
          ]);
        }

        return entries;
      }, []),
    );

    this.updatedComponentNames = Object.freeze(
      Array.from(this.updatesByComponent.keys(), (component) => component.name),
    );
  }
}

export type ChangedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> =
  | CreatedNode<TRequestContext, TConnector>
  | DeletedNode<TRequestContext, TConnector>
  | UpdatedNode<TRequestContext, TConnector>;
