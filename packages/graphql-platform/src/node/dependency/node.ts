import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert';
import type { Node } from '../../node.js';
import { NodeCreation, NodeDeletion, type NodeChange } from '../change.js';
import type { Component } from '../definition.js';
import { MutationContextChangesByNode } from '../operation/mutation/context/changes.js';

export type NodeDependencyJSON = {
  [utils.MutationType.CREATION]?: boolean;
  [utils.MutationType.DELETION]?: boolean;
  [utils.MutationType.UPDATE]?: Component['name'][];
};

export class NodeDependency {
  public readonly [utils.MutationType.CREATION]: boolean;
  public readonly [utils.MutationType.DELETION]: boolean;
  public readonly [utils.MutationType.UPDATE]: ReadonlySet<Component>;

  public readonly normalized?: this;

  public constructor(
    public readonly node: Node,
    config?: {
      [utils.MutationType.CREATION]?: boolean;
      [utils.MutationType.DELETION]?: boolean;
      [utils.MutationType.UPDATE]?: ReadonlySet<Component>;
    },
  ) {
    this[utils.MutationType.CREATION] =
      config?.[utils.MutationType.CREATION] === true;

    this[utils.MutationType.DELETION] =
      config?.[utils.MutationType.DELETION] === true;

    this[utils.MutationType.UPDATE] = new Set(
      config?.[utils.MutationType.UPDATE],
    );

    this.normalized =
      this[utils.MutationType.CREATION] ||
      this[utils.MutationType.DELETION] ||
      this[utils.MutationType.UPDATE].size
        ? this
        : undefined;
  }

  public mergeWith(other?: NodeDependency): this | NodeDependency {
    if (!other) {
      return this;
    }

    assert.strictEqual(other.node, this.node);

    return new NodeDependency(this.node, {
      [utils.MutationType.CREATION]:
        this[utils.MutationType.CREATION] || other[utils.MutationType.CREATION],

      [utils.MutationType.DELETION]:
        this[utils.MutationType.DELETION] || other[utils.MutationType.DELETION],

      [utils.MutationType.UPDATE]: this[utils.MutationType.UPDATE].union(
        other[utils.MutationType.UPDATE],
      ),
    });
  }

  public equals(other: NodeDependency): boolean {
    return utils.mutationTypes.every((mutationType) => {
      switch (mutationType) {
        case utils.MutationType.UPDATE:
          return (
            this[mutationType].size === other[mutationType].size &&
            !this[mutationType].difference(other[mutationType]).size
          );

        default:
          return this[mutationType] === other[mutationType];
      }
    });
  }

  public dependsOn(change: NodeChange): boolean {
    return change instanceof NodeCreation
      ? this[utils.MutationType.CREATION]
      : change instanceof NodeDeletion
        ? this[utils.MutationType.DELETION]
        : this[utils.MutationType.UPDATE].size && change.updatesByComponent.size
          ? !this[utils.MutationType.UPDATE].isDisjointFrom(
              change.updatesByComponent,
            )
          : false;
  }

  public dependsOnChanges(changes?: MutationContextChangesByNode): boolean {
    return changes?.size
      ? utils.mutationTypes.some((mutationType) => {
          switch (mutationType) {
            case utils.MutationType.UPDATE:
              return this[mutationType].size
                ? changes[mutationType]
                    .values()
                    .some(
                      ({ updatesByComponent }) =>
                        !this[mutationType].isDisjointFrom(updatesByComponent),
                    )
                : false;

            default:
              return this[mutationType] && changes[mutationType].size > 0;
          }
        })
      : false;
  }

  public filterChanges<TRequestContext extends object>(
    changes?: MutationContextChangesByNode<TRequestContext>,
  ): IteratorObject<NodeChange<TRequestContext>> | undefined {
    if (!changes?.size) {
      return undefined;
    }

    return utils.mutationTypes.values().flatMap<NodeChange>((mutationType) => {
      switch (mutationType) {
        case utils.MutationType.UPDATE:
          return this[mutationType].size
            ? changes[mutationType]
                .values()
                .filter(
                  ({ updatesByComponent }) =>
                    !this[mutationType].isDisjointFrom(updatesByComponent),
                )
            : [];

        default:
          return this[mutationType] ? changes[mutationType].values() : [];
      }
    });
  }

  public toJSON(): NodeDependencyJSON {
    return {
      ...(this[utils.MutationType.CREATION] && {
        [utils.MutationType.CREATION]: this[utils.MutationType.CREATION],
      }),

      ...(this[utils.MutationType.DELETION] && {
        [utils.MutationType.DELETION]: this[utils.MutationType.DELETION],
      }),

      ...(this[utils.MutationType.UPDATE].size && {
        [utils.MutationType.UPDATE]: Array.from(
          this[utils.MutationType.UPDATE],
          ({ name }) => name,
        ),
      }),
    };
  }
}
