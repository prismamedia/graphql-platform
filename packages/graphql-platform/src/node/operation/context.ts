import { MutationType, type Path } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import type { NodeFilter } from '../statement/filter.js';
import { createContextBoundAPI, type ContextBoundAPI } from './api.js';

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

  public getNodeAuthorization(
    node: Node<TRequestContext, TConnector>,
    path: Path,
    mutationType?: MutationType,
  ): NodeFilter<TRequestContext, TConnector> | undefined {
    return node.getAuthorizationByRequestContext(
      this.requestContext,
      path,
      mutationType,
    );
  }

  /**
   * Returns a "context"-bound version of the API, so the developer only has to provide the operations' args
   */
  @Memoize()
  public get api(): ContextBoundAPI<TRequestContext, TConnector> {
    return createContextBoundAPI(this.gp, this);
  }
}
