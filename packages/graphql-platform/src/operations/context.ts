import type { OperationTypeNode } from 'graphql';
import type { GraphQLPlatform } from '..';
import type { IConnector } from '../connector';

export type TPostSuccessEvent = (...args: []) => boolean;

export class OperationContext<
  TContext = any,
  TConnector extends IConnector = any
> {
  /**
   * Contains the events that will be fired after the success of the whole operation, including all the nested actions
   */
  public readonly postSuccessEvents: TPostSuccessEvent[] = [];

  public constructor(
    /**
     * The GraphQL Platform itself is provided
     */
    public readonly gp: GraphQLPlatform<any, TConnector>,

    /**
     * The operation type
     */
    public readonly type: OperationTypeNode,

    /**
     * The context, provided by the integration or at execution time
     */
    public readonly context: TContext,
  ) {}

  /**
   * A shortcut to the registered connector
   */
  public get connector(): TConnector {
    return this.gp.connector;
  }
}
