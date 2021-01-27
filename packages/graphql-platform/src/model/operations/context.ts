import { addPath, Path } from '@prismamedia/graphql-platform-utils';
import { OperationTypeNode } from 'graphql';
import { GraphQLPlatform } from '../..';
import { ConnectorInterface } from '../../connector';
import { Model } from '../../model';
import {
  OperationKey,
  OperationParameters,
  OperationResult,
} from '../operations';

export type BoundAPI<TRequestContext, TConnector extends ConnectorInterface> = {
  [TKey in OperationKey]: (
    modelName: Model['name'],
    args: OperationParameters<TKey, TRequestContext, TConnector>[0],
  ) => OperationResult<TKey>;
};

export type PostSuccessEvent = (...args: any[]) => boolean;

export class OperationContext<
  TRequestContext = any,
  TConnector extends ConnectorInterface = any,
> {
  /**
   * Contains the proxies' "revoke" methods in order to forbid their usage after the operation is finished
   */
  readonly #revocableBoundAPI: Array<() => void> = [];

  /**
   * Contains the events that will be fired after the success of the whole operation, including all the nested actions
   */
  public readonly postSuccessEvents: PostSuccessEvent[] = [];

  public constructor(
    /**
     * The GraphQL Platform itself is provided for convenience
     */
    public readonly gp: GraphQLPlatform<TRequestContext, TConnector>,

    /**
     * The operation type
     */
    public readonly type: OperationTypeNode,

    /**
     * The "request" context, provided by the integration or at execution time
     *
     * Unlike the "operation" context, it is shared among all the operations of the "request"
     */
    public readonly requestContext: TRequestContext,
  ) {}

  /**
   * A simple shortcut to the registered connector
   */
  public get connector(): TConnector {
    return this.gp.connector;
  }

  /**
   * Create a "context" bound version of the API
   */
  public createBoundAPI(path: Path): BoundAPI<TRequestContext, TConnector> {
    const { proxy, revoke } = Proxy.revocable({} as any, {
      get:
        (_, operationKey: OperationKey) =>
        (modelName: Model['name'], args: any) =>
          this.gp
            .getModel(modelName, path)
            .getOperation<any>(operationKey, path)
            .execute(args, this, addPath(path, operationKey)),
    });

    // Keep a reference to this proxy's "revoke" method
    this.#revocableBoundAPI.push(revoke);

    return proxy;
  }

  public revoke(): void {
    let revoke: undefined | (() => void);
    while ((revoke = this.#revocableBoundAPI.shift())) {
      revoke();
    }
  }
}
