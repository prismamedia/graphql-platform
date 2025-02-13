import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
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

    const newValue = rawNewValue
      ? Object.freeze(
          node.selection.parseSource(
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
}
