import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import type { NodeFilter } from '../statement/filter.js';
import { createContextBoundAPI, type ContextBoundAPI } from './api.js';
import { UnauthorizedError } from './error.js';

export class OperationContext<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
> {
  public constructor(
    /**
     * The GraphQL Platform itself is provided for convenience
     */
    public readonly gp: GraphQLPlatform<TRequestContext, TConnector>,

    /**
     * The "request" context, provided by the integration or at execution time
     *
     * Unlike the "operation" context, it is shared among all the operations of the "request"'s document
     */
    public readonly requestContext: TRequestContext,
  ) {
    gp.assertRequestContext(requestContext);
  }

  @Memoize(
    (node: Node, mutationType?: utils.MutationType) =>
      `${node}-${mutationType ?? ''}`,
  )
  public getAuthorization(
    node: Node<TRequestContext, TConnector>,
    mutationType?: utils.MutationType,
  ): NodeFilter<TRequestContext, TConnector> | undefined {
    return node.getAuthorization(this, mutationType);
  }

  public ensureAuthorization(
    node: Node<TRequestContext, TConnector>,
    path: utils.Path,
    mutationType?: utils.MutationType,
  ): NodeFilter<TRequestContext, TConnector> | undefined {
    const authorization = this.getAuthorization(node, mutationType);
    if (authorization?.isFalse()) {
      throw new UnauthorizedError(node, mutationType, { path });
    }

    return authorization;
  }

  /**
   * Returns a "context"-bound version of the API, so the developer only has to provide the operations' args
   */
  @Memoize()
  public get api(): ContextBoundAPI<TRequestContext, TConnector> {
    return createContextBoundAPI(this.gp, this);
  }
}
