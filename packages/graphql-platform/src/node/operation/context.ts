import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
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
> implements Disposable
{
  /**
   * Stores arbitrary data for the duration of the operation
   */
  public readonly userData: Map<any, any>;

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
  ) {
    this.userData = new Map();
  }

  public [Symbol.dispose]() {
    this.userData.clear();
  }

  /**
   * Returns a "context"-bound version of the API, so the developer only has to provide the operations' args
   */
  @MGetter
  public get api(): ContextBoundAPI {
    return this.gp.createContextBoundAPI(this);
  }

  @MMethod(
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
      throw new UnauthorizedError(this.request, node, {
        cause,
        mutationType,
        path,
      });
    }

    if (authorization?.isFalse()) {
      throw new UnauthorizedError(this.request, node, {
        mutationType,
        path,
      });
    }

    return authorization;
  }
}
