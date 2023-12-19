import * as utils from '@prismamedia/graphql-platform-utils';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';

export class NodeDeletion<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static createFromNonNullableComponents<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    partialOldValue: Record<Component['name'], ComponentValue>,
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
        ...partialOldValue,
      },
      createdAt,
      committedAt,
    );
  }

  public override readonly kind = utils.MutationType.DELETION;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: undefined;

  public constructor(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const oldValue = Object.freeze(node.selection.parseSource(maybeOldValue));

    super(
      node,
      node.mainIdentifier.parseValue(oldValue),
      requestContext,
      createdAt,
      committedAt,
    );

    this.oldValue = oldValue;
  }
}
