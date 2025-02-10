import type * as utils from '@prismamedia/graphql-platform-utils';
import type { Node, UniqueConstraintValue } from '../node.js';
import type { NodeChange } from './change.js';

export abstract class AbstractNodeChange<TRequestContext extends object> {
  public abstract readonly kind: utils.MutationType;

  public readonly stringifiedId: string;

  public constructor(
    public readonly node: Node<TRequestContext>,
    public readonly id: Readonly<UniqueConstraintValue>,
    public readonly requestContext: TRequestContext,
    public at: Date = new Date(),
  ) {
    Object.freeze(id);

    const pureLeafIdentifier = node.mainIdentifier.isPureLeaf()
      ? node.mainIdentifier.getPureLeaf()
      : undefined;

    this.stringifiedId = pureLeafIdentifier
      ? pureLeafIdentifier.stringify(id[pureLeafIdentifier.name])
      : node.mainIdentifier.stringify(id);
  }

  public toString(): string {
    return `${this.node}/${this.stringifiedId}/${this.kind}`;
  }

  public isMergeableWith(other: NodeChange<TRequestContext>): boolean {
    return (
      this.node === other.node &&
      this.stringifiedId === other.stringifiedId &&
      this.requestContext === other.requestContext &&
      this.at <= other.at
    );
  }

  public abstract mergeWith(
    other: NodeChange<TRequestContext>,
  ): NodeChange<TRequestContext> | undefined;
}
