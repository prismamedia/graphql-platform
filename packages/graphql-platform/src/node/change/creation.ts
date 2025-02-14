import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import type { Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';
import type { NodeChange } from '../change.js';

export class NodeCreation<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static unserialize<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    serializedNewValue: JsonObject,
    executedAt?: Date,
    committedAt?: Date,
  ): NodeCreation<TRequestContext> {
    return new this(
      node,
      requestContext,
      node.selection.unserialize(serializedNewValue),
      executedAt,
      committedAt,
    );
  }

  public override readonly kind = utils.MutationType.CREATION;

  public readonly oldValue: undefined;
  public readonly newValue: Readonly<NodeValue>;

  public constructor(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    rawNewValue: unknown,
    executedAt?: Date,
    committedAt?: Date,
  ) {
    utils.assertPlainObject(rawNewValue);

    const newValue = Object.freeze(
      node.selection.parseSource(
        Object.fromEntries(
          node.componentSet.values().map((component) => {
            const rawNewComponentValue = rawNewValue[component.name];

            return [
              component.name,
              rawNewComponentValue === undefined && component.isNullable()
                ? null
                : rawNewComponentValue,
            ];
          }),
        ),
      ),
    );

    super(
      node,
      node.mainIdentifier.parseValue(newValue),
      requestContext,
      executedAt,
      committedAt,
    );

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
          other.executedAt,
        );

      case utils.MutationType.DELETION:
        // This "deletion" cancels the previous "creation" => no change
        return;
    }
  }

  @MGetter
  public get serializedNewValue(): JsonObject {
    return this.node.selection.serialize(this.newValue);
  }
}
