import * as utils from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node, UniqueConstraintValue } from '../node.js';

export abstract class AbstractNodeChange<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  public abstract readonly kind: utils.MutationType;

  public readonly stringifiedId: string;

  public constructor(
    public readonly node: Node<TRequestContext, TConnector>,
    public readonly id: Readonly<UniqueConstraintValue>,
    public readonly requestContext: TRequestContext,
    public readonly createdAt: Date = new Date(),
    public committedAt?: Date,
  ) {
    this.stringifiedId = node.identifier.stringify(id);
  }

  public toString(): string {
    return `${this.node}/${this.stringifiedId}/${this.kind}`;
  }

  public get at(): Date {
    return this.committedAt ?? this.createdAt;
  }
}
