import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { BrokerInterface } from '../../broker-interface.js';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import type { NodeFilter } from '../statement/filter.js';
import type { ContextBoundAPI } from './api.js';
import { UnauthorizedError } from './error.js';

export class OperationContext<
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> {
  public constructor(
    /**
     * The GraphQL-Platform itself is provided for convenience
     */
    public readonly gp: GraphQLPlatform<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >,

    /**
     * The "request" context, provided by the integration or at execution time
     *
     * Unlike the "operation" context, it is shared among all the operations of the "request"'s document
     */
    public readonly request: TRequestContext,
  ) {}

  /**
   * Returns a "context"-bound version of the API, so the developer only has to provide the operations' args
   */
  @Memoize()
  public get api(): ContextBoundAPI {
    return this.gp.createContextBoundAPI(this);
  }

  @Memoize(
    (node: Node, mutationType?: utils.MutationType) =>
      `${node}#${mutationType ?? ''}`,
  )
  public getAuthorization(
    node: Node,
    mutationType?: utils.MutationType,
  ): NodeFilter | undefined {
    return node.getAuthorization(this, mutationType);
  }

  public ensureAuthorization(
    node: Node,
    path: utils.Path,
    mutationType?: utils.MutationType,
  ): NodeFilter | undefined {
    let authorization: NodeFilter | undefined;

    try {
      authorization = this.getAuthorization(node, mutationType);
    } catch (cause) {
      throw new UnauthorizedError(node, mutationType, {
        path,
        cause: new utils.GraphError(`The request-authorizer failed`, { cause }),
      });
    }

    if (authorization?.isFalse()) {
      throw new UnauthorizedError(node, mutationType, { path });
    }

    return authorization;
  }
}
