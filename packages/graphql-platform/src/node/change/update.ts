import * as utils from '@prismamedia/graphql-platform-utils';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';

export type ComponentUpdate<TValue extends ComponentValue = any> = {
  oldValue: TValue;
  newValue: TValue;
};

export class NodeUpdate<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static createFromNonNullableComponents<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    partialOldValue: Record<Component['name'], ComponentValue>,
    partialNewValue: Record<Component['name'], ComponentValue>,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const oldValue = {
      ...Object.fromEntries(
        Array.from(node.componentSet, (component) => [
          component.name,
          component.isNullable() ? null : undefined,
        ]),
      ),
      ...partialOldValue,
    };

    return new this(
      node,
      requestContext,
      oldValue,
      { ...oldValue, ...partialNewValue },
      createdAt,
      committedAt,
    );
  }

  public override readonly kind = utils.MutationType.UPDATE;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: Readonly<NodeValue>;

  public readonly updatesByComponent: ReadonlyMap<
    Component,
    Readonly<ComponentUpdate>
  >;

  public constructor(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    maybeNewValue: unknown,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const oldValue = Object.freeze(node.selection.parseSource(maybeOldValue));
    const newValue = Object.freeze(node.selection.parseSource(maybeNewValue));

    super(
      node,
      node.mainIdentifier.parseValue(newValue),
      requestContext,
      createdAt,
      committedAt,
    );

    this.oldValue = oldValue;
    this.newValue = newValue;

    this.updatesByComponent = new Map(
      Array.from(node.componentsByName.values()).reduce<
        [Component, ComponentUpdate][]
      >((entries, component) => {
        if (component.isMutable()) {
          const oldComponentValue: any = oldValue[component.name];
          const newComponentValue: any = newValue[component.name];

          if (
            !component.selection.areValuesEqual(
              oldComponentValue,
              newComponentValue,
            )
          ) {
            entries.push([
              component,
              Object.freeze({
                oldValue: oldComponentValue,
                newValue: newComponentValue,
              }),
            ]);
          }
        }

        return entries;
      }, []),
    );
  }

  public isEmpty(): boolean {
    return this.updatesByComponent.size === 0;
  }

  public hasComponentUpdate(
    componentOrName: Component | Component['name'],
  ): boolean {
    const component = this.node.ensureComponent(componentOrName);

    return this.updatesByComponent.has(component);
  }

  public getComponentUpdate<TValue extends ComponentValue>(
    componentOrName: Component | Component['name'],
  ): ComponentUpdate<TValue> | undefined {
    const component = this.node.ensureComponent(componentOrName);

    return this.updatesByComponent.get(component);
  }
}
