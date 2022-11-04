import * as utils from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';

export class NodeCreation<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> extends AbstractNodeChange<TRequestContext, TConnector> {
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
