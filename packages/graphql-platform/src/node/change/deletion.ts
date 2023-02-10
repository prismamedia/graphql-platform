import * as utils from '@prismamedia/graphql-platform-utils';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { Node, NodeValue } from '../../node.js';
import { AbstractNodeChange } from '../abstract-change.js';

export class NodeDeletion<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TServiceContainer extends object = any,
> extends AbstractNodeChange<TRequestContext, TConnector, TServiceContainer> {
  public override readonly kind = utils.MutationType.DELETION;

  public readonly oldValue: Readonly<NodeValue>;
  public readonly newValue: undefined;

  public constructor(
    node: Node<TRequestContext, TConnector, TServiceContainer>,
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
