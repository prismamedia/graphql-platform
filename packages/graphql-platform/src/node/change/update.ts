import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { JsonObject } from 'type-fest';
import type { Component, ComponentValue, Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';
import type { NodeChange } from '../change.js';
import { NodeDeletion } from './deletion.js';

export type ComponentUpdate<TValue extends ComponentValue = any> = {
  oldValue: TValue;
  newValue: TValue;
};

export class NodeUpdate<
  TRequestContext extends object = any,
> extends AbstractNodeChange<TRequestContext> {
  public static unserialize<TRequestContext extends object>(
    node: Node<TRequestContext>,
    requestContext: TRequestContext,
    serializedOldValue: JsonObject,
    serializedUpdates: JsonObject | undefined,
    executedAt?: Date,
    committedAt?: Date,
  ): NodeUpdate<TRequestContext> {
    return new this(
      node,
      requestContext,
      node.selection.unserialize(serializedOldValue),
      serializedUpdates
        ? Object.fromEntries(
            Object.entries(serializedUpdates).map(
              ([componentName, componentNewValue]) => [
                componentName,
                node
                  .getComponentByName(componentName)
                  .selection.unserialize(componentNewValue),
              ],
            ),
          )
        : undefined,
      executedAt,
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
    rawOldValue: unknown,
    rawNewValue: unknown,
    executedAt?: Date,
    committedAt?: Date,
  ) {
    utils.assertPlainObject(rawOldValue);
    utils.assertNillablePlainObject(rawNewValue);

    const oldValue = node.selection.parseSource(
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
    );

    const newValue = rawNewValue
      ? node.selection.parseSource(
          Object.fromEntries(
            node.componentSet.values().map((component) => {
              const rawNewComponentValue = rawNewValue[component.name];

              return [
                component.name,
                rawNewComponentValue === undefined
                  ? oldValue[component.name]
                  : rawNewComponentValue,
              ];
            }),
          ),
        )
      : oldValue;

    super(
      node,
      node.mainIdentifier.parseValue(newValue),
      requestContext,
      executedAt,
      committedAt,
    );

    this.oldValue = oldValue;
    this.newValue = newValue;

    this.updatesByComponent = new Map(
      node.componentsByName
        .values()
        .reduce<[Component, ComponentUpdate][]>((entries, component) => {
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
                {
                  oldValue: oldComponentValue,
                  newValue: newComponentValue,
                },
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

  public mergeWith(
    other: NodeChange<TRequestContext>,
  ): NodeChange<TRequestContext> | undefined {
    assert(this.isMergeableWith(other));

    switch (other.kind) {
      case utils.MutationType.CREATION:
        // Should not happen, we missed something
        return other;

      case utils.MutationType.UPDATE:
        const aggregate = new NodeUpdate(
          other.node,
          other.requestContext,
          this.oldValue,
          other.newValue,
          other.executedAt,
        );

        return aggregate.isEmpty() ? undefined : aggregate;

      case utils.MutationType.DELETION:
        return new NodeDeletion(
          other.node,
          other.requestContext,
          this.oldValue,
          other.executedAt,
        );
    }
  }

  @MGetter
  public get serializedOldValue(): JsonObject {
    return this.node.selection.serialize(this.oldValue);
  }

  @MGetter
  public get serializedUpdates(): JsonObject {
    return this.updatesByComponent.entries().reduce(
      (document, [{ name, selection }, update]) =>
        Object.assign(document, {
          [name]: selection.serialize(update.newValue),
        }),
      Object.create(null),
    );
  }

  @MGetter
  public get serializedNewValue(): JsonObject {
    return this.node.selection.serialize(this.newValue);
  }
}
