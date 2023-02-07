import * as utils from '@prismamedia/graphql-platform-utils';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';

export class NodeUpdate<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public override readonly kind = utils.MutationType.UPDATE;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: Readonly<NodeValue>;

  public readonly updatesByComponent: ReadonlyMap<
    Component,
    Readonly<{ oldValue: ComponentValue; newValue: ComponentValue }>
  >;
  public readonly updatedComponentNames: ReadonlyArray<Component['name']>;

  public constructor(
    node: Node,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    maybeNewValue: unknown,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const oldValue = Object.freeze(node.parseValue(maybeOldValue));
    const newValue = Object.freeze(node.parseValue(maybeNewValue));

    super(
      node,
      Object.freeze(node.identifier.parseValue(newValue)),
      requestContext,
      createdAt,
      committedAt,
    );

    this.oldValue = oldValue;
    this.newValue = newValue;

    this.updatesByComponent = new Map(
      node.components.reduce<
        [
          Component,
          Readonly<{ oldValue: ComponentValue; newValue: ComponentValue }>,
        ][]
      >((entries, component) => {
        const oldComponentValue: any = oldValue[component.name];
        const newComponentValue: any = newValue[component.name];

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
      Array.from(this.updatesByComponent.keys(), ({ name }) => name),
    );
  }
}
