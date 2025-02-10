import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';
import type { NodeChange } from '../change.js';
import { NodeUpdate } from './update.js';

export class NodeDeletion<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static createFromPartial<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    partialOldValue: Record<Component['name'], ComponentValue>,
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
        ...partialOldValue,
      },
      at,
    );
  }

  public override readonly kind = utils.MutationType.DELETION;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: undefined;

  public constructor(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    at?: Date,
  ) {
    const oldValue = Object.freeze(node.selection.parseSource(maybeOldValue));

    super(node, node.mainIdentifier.parseValue(oldValue), requestContext, at);

    this.oldValue = oldValue;
  }

  public mergeWith(
    other: NodeChange<TRequestContext>,
  ): NodeChange<TRequestContext> | undefined {
    assert(this.isMergeableWith(other));

    switch (other.kind) {
      case utils.MutationType.CREATION:
        const aggregate = new NodeUpdate(
          other.node,
          other.requestContext,
          this.oldValue,
          other.newValue,
          other.at,
        );

        return aggregate.isEmpty() ? undefined : aggregate;

      default:
        // Should not happen, we missed something
        return other;
    }
  }
}
