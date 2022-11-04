import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node, UniqueConstraintValue } from '../node.js';

export abstract class AbstractNodeChange<
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

  @Memoize()
  public toString(): string {
    return `${this.node}/${this.kind}/${this.flattenedId}`;
  }

  public get at(): Date {
    return this.committedAt ?? this.createdAt;
  }
}
