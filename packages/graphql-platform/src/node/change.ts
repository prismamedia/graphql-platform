import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node, NodeValue } from '../node.js';

abstract class AbstractChangedNode<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
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
  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: Readonly<NodeValue>;

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
  }

  @Memoize()
  public hasDifference(): boolean {
    return !this.node.areValuesEqual(this.oldValue, this.newValue);
  }
}

export type ChangedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> =
  | CreatedNode<TRequestContext, TConnector>
  | DeletedNode<TRequestContext, TConnector>
  | UpdatedNode<TRequestContext, TConnector>;
