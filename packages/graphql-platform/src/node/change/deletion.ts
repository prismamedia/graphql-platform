import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import type { Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';
import type { NodeChange } from '../change.js';
import { NodeUpdate } from './update.js';

export class NodeDeletion<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static unserialize<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    serializedOldValue: JsonObject,
    executedAt?: Date,
    committedAt?: Date,
  ): NodeDeletion<TRequestContext> {
    return new this(
      node,
      requestContext,
      node.selection.unserialize(serializedOldValue),
      executedAt,
      committedAt,
    );
  }

  public override readonly kind = utils.MutationType.DELETION;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: undefined;

  public constructor(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    rawOldValue: unknown,
    executedAt?: Date,
    committedAt?: Date,
  ) {
    utils.assertPlainObject(rawOldValue);

    const oldValue = Object.freeze(
      node.selection.parseSource(
        Object.fromEntries(
          node.componentSet.values().map((component) => {
            const rawOldComponentValue = rawOldValue[component.name];

            return [
              component.name,
              rawOldComponentValue === undefined && component.isNullable()
                ? null
                : rawOldComponentValue,
            ];
          }),
        ),
      ),
    );

    super(
      node,
      node.mainIdentifier.parseValue(oldValue),
      requestContext,
      executedAt,
      committedAt,
    );

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
          other.executedAt,
        );

        return aggregate.isEmpty() ? undefined : aggregate;

      default:
        // Should not happen, we missed something
        return other;
    }
  }

  @MGetter
  public get serializedOldValue(): JsonObject {
    return this.node.selection.serialize(this.oldValue);
  }
}
