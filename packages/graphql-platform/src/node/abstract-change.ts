import type * as utils from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node, UniqueConstraintValue } from '../node.js';

export abstract class AbstractNodeChange<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> {
  public abstract readonly kind: utils.MutationType;

  public readonly stringifiedId: string;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector, TContainer>,
    public readonly id: Readonly<UniqueConstraintValue>,
    public readonly requestContext: TRequestContext,
    public readonly createdAt: Date = new Date(),
    public committedAt?: Date,
  ) {
    Object.freeze(id);

    const pureIdentifierLeaf =
      node.identifier.componentSet.size === 1
        ? node.identifier.leafSet.values().next().value
        : undefined;

    this.stringifiedId = pureIdentifierLeaf
      ? pureIdentifierLeaf.stringify(id[pureIdentifierLeaf.name])
      : node.identifier.stringify(id);
  }

  public toString(): string {
    return `${this.node}/${this.stringifiedId}/${this.kind}`;
  }

  public get at(): Date {
    return this.committedAt ?? this.createdAt;
  }
}
