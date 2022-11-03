import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../connector-interface.js';
import type {
  Component,
  ComponentValue,
  Node,
  NodeValue,
  UniqueConstraintValue,
} from '../node.js';

abstract class AbstractChangedNode<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  public abstract readonly kind: utils.MutationType;

  public readonly flattenedId: string;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly id: Readonly<UniqueConstraintValue>,
    public readonly requestContext: TRequestContext,
    public readonly createdAt: Date = new Date(),
    public committedAt?: Date,
  ) {
    this.flattenedId = node.identifier.flatten(id);
  }

  public get at(): Date {
    return this.committedAt ?? this.createdAt;
  }
}

export class CreatedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractChangedNode<TRequestContext, TConnector> {
  public override readonly kind = utils.MutationType.CREATION;

  public readonly oldValue: undefined;
  public readonly newValue: Readonly<NodeValue>;

  public constructor(
    node: Node<TRequestContext, TConnector>,
    requestContext: TRequestContext,
    maybeNewValue: unknown,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const newValue = Object.freeze(node.parseValue(maybeNewValue));

    super(
      node,
      Object.freeze(node.identifier.parseValue(newValue)),
      requestContext,
      createdAt,
      committedAt,
    );

    this.newValue = newValue;
  }
}

export class UpdatedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractChangedNode<TRequestContext, TConnector> {
  public override readonly kind = utils.MutationType.UPDATE;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: Readonly<NodeValue>;

  public readonly updatesByComponent: ReadonlyMap<
    Component<TRequestContext, TConnector>,
    Readonly<{ oldValue: ComponentValue; newValue: ComponentValue }>
  >;
  public readonly updatedComponentNames: ReadonlyArray<Component['name']>;

  public constructor(
    node: Node<TRequestContext, TConnector>,
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
      Array.from(this.updatesByComponent.keys(), (component) => component.name),
    );
  }
}

export class DeletedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractChangedNode<TRequestContext, TConnector> {
  public override readonly kind = utils.MutationType.DELETION;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: undefined;

  public constructor(
    node: Node<TRequestContext, TConnector>,
    requestContext: TRequestContext,
    maybeOldValue: unknown,
    createdAt?: Date,
    committedAt?: Date,
  ) {
    const oldValue = Object.freeze(node.parseValue(maybeOldValue));

    super(
      node,
      Object.freeze(node.identifier.parseValue(oldValue)),
      requestContext,
      createdAt,
      committedAt,
    );

    this.oldValue = oldValue;
  }
}

export type ChangedNode<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> =
  | CreatedNode<TRequestContext, TConnector>
  | UpdatedNode<TRequestContext, TConnector>
  | DeletedNode<TRequestContext, TConnector>;

export class ChangesAggregation<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> implements Iterable<ChangedNode<TRequestContext, TConnector>>
{
  readonly #changesByIdByNode = new Map<
    Node<TRequestContext, TConnector>,
    Map<string, ChangedNode<TRequestContext, TConnector>>
  >();

  public constructor(
    changes: ReadonlyArray<ChangedNode<TRequestContext, TConnector>>,
  ) {
    changes.forEach((change) => {
      let changeById = this.#changesByIdByNode.get(change.node);
      if (!changeById) {
        this.#changesByIdByNode.set(change.node, (changeById = new Map()));
      }

      let previousChange = changeById.get(change.flattenedId);
      if (!previousChange) {
        changeById.set(change.flattenedId, change);
      } else {
        assert(
          previousChange.createdAt <= change.createdAt,
          'The aggregation has to be done in the order the changes have occured.',
        );

        switch (previousChange.kind) {
          case utils.MutationType.CREATION:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                // Can't happen - we missed something
                changeById.set(change.flattenedId, change);
                break;
              }

              case utils.MutationType.UPDATE: {
                changeById.set(
                  change.flattenedId,
                  new CreatedNode(
                    change.node,
                    change.requestContext,
                    change.newValue,
                    change.createdAt,
                    change.committedAt,
                  ),
                );
                break;
              }

              case utils.MutationType.DELETION:
                this.delete(change);
                break;
            }
            break;

          case utils.MutationType.UPDATE:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                // Can't happen - we missed something
                changeById.set(change.flattenedId, change);
                break;
              }

              case utils.MutationType.UPDATE: {
                if (
                  change.node.areValuesEqual(
                    previousChange.newValue,
                    change.oldValue,
                  )
                ) {
                  const aggregate = new UpdatedNode(
                    change.node,
                    change.requestContext,
                    previousChange.oldValue,
                    change.newValue,
                    change.createdAt,
                    change.committedAt,
                  );

                  if (aggregate.updatesByComponent.size) {
                    changeById.set(change.flattenedId, aggregate);
                  } else {
                    this.delete(change);
                  }
                } else {
                  // Can't happen - we missed something
                  changeById.set(change.flattenedId, change);
                }
                break;
              }

              case utils.MutationType.DELETION:
                changeById.set(change.flattenedId, change);
                break;
            }
            break;

          case utils.MutationType.DELETION:
            switch (change.kind) {
              case utils.MutationType.CREATION: {
                const aggregate = new UpdatedNode(
                  change.node,
                  change.requestContext,
                  previousChange.oldValue,
                  change.newValue,
                  change.createdAt,
                  change.committedAt,
                );

                if (aggregate.updatesByComponent.size) {
                  changeById.set(change.flattenedId, aggregate);
                } else {
                  this.delete(change);
                }
                break;
              }

              case utils.MutationType.UPDATE: {
                // Can't happen - we missed something
                changeById.set(change.flattenedId, change);
                break;
              }

              case utils.MutationType.DELETION: {
                // Can't happen - we missed something
                changeById.set(change.flattenedId, change);
                break;
              }
            }
            break;
        }
      }
    });
  }

  protected delete(change: ChangedNode<TRequestContext, TConnector>): void {
    let changeByFlattenedId = this.#changesByIdByNode.get(change.node);

    if (
      changeByFlattenedId?.delete(change.flattenedId) &&
      changeByFlattenedId.size === 0
    ) {
      this.#changesByIdByNode.delete(change.node);
    }
  }

  *[Symbol.iterator](): IterableIterator<
    ChangedNode<TRequestContext, TConnector>
  > {
    for (const changesByFlattenedId of this.#changesByIdByNode.values()) {
      yield* changesByFlattenedId.values();
    }
  }

  @Memoize()
  public get length(): number {
    return Array.from(this).length;
  }

  @Memoize()
  public get changesByNode(): Map<
    Node<TRequestContext, TConnector>,
    ChangedNode<TRequestContext, TConnector>[]
  > {
    return new Map(
      Array.from(this.#changesByIdByNode.entries()).map(
        ([node, changesByFlattenedId]) => [
          node,
          Array.from(changesByFlattenedId.values()),
        ],
      ),
    );
  }
}
