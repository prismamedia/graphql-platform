import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';
import type { NodeChange } from '../change.js';

export class NodeCreation<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static createFromPartial<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    partialNewValue: Record<Component['name'], ComponentValue>,
    at?: Date,
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
      at,
    );
  }

  public override readonly kind = utils.MutationType.CREATION;

  public readonly oldValue: undefined;
  public readonly newValue: Readonly<NodeValue>;

  public constructor(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    maybeNewValue: unknown,
    at?: Date,
  ) {
    const newValue = Object.freeze(node.selection.parseSource(maybeNewValue));

    super(node, node.mainIdentifier.parseValue(newValue), requestContext, at);

    this.newValue = newValue;
  }

  public mergeWith(
    other: NodeChange<TRequestContext>,
  ): NodeChange<TRequestContext> | undefined {
    assert(this.isMergeableWith(other));

    switch (other.kind) {
      case utils.MutationType.CREATION:
        // Should not happen, we missed something
        return other;

      case utils.MutationType.UPDATE:
        return new NodeCreation(
          other.node,
          other.requestContext,
          other.newValue,
          this.at,
        );

      case utils.MutationType.DELETION:
        // This "deletion" cancels the previous "creation" => no change
        return;
    }
  }
}
