import * as utils from '@prismamedia/graphql-platform-utils';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';

export class NodeCreation<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static createFromPartial<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    partialNewValue: Record<Component['name'], ComponentValue>,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    return new this(
      node,
      requestContext,
      {
        ...Object.fromEntries(
          Array.from(node.componentSet, (component) => [
            component.name,
            component.isNullable() ? null : undefined,
          ]),
        ),
        ...partialNewValue,
      },
      createdAt,
      committedAt,
    );
  }

  public override readonly kind = utils.MutationType.CREATION;

  public readonly oldValue: undefined;
  public readonly newValue: Readonly<NodeValue>;

  public constructor(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    maybeNewValue: unknown,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const newValue = Object.freeze(node.selection.parseSource(maybeNewValue));

    super(
      node,
      node.mainIdentifier.parseValue(newValue),
      requestContext,
      createdAt,
      committedAt,
    );

    this.newValue = newValue;
  }
}
