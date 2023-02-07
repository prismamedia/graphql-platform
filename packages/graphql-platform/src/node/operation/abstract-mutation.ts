import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import {
  AbstractOperation,
  type NodeSelectionAwareArgs,
} from '../abstract-operation.js';
import { NodeChangeAggregation } from '../change.js';
import { AndOperation, NodeFilter } from '../statement/filter.js';
import type { ContextBoundAPI } from './api.js';
import { ConnectorError } from './error.js';
import { MutationContext } from './mutation/context.js';
import type { MutationInterface } from './mutation/interface.js';

export interface AbstractMutationHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> {
  /**
   * The GraphQL-Platform instance
   */
  gp: GraphQLPlatform<TRequestContext, TConnector, TContainer>;

  /**
   * The node's definition
   */
  node: Node<TRequestContext, TConnector, TContainer>;

  /**
   * The current context
   */
  context: MutationContext<TRequestContext, TConnector, TContainer>;

  /**
   * The context-bound API
   */
  api: ContextBoundAPI<TRequestContext>;
}

export interface AbstractMutationConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TContainer extends object,
> {
  /**
   * Optional, either the mutation is enabled or not
   */
  enabled?: utils.OptionalFlag;

  /**
   * Optional, either the mutation is exposed publicly (= in the GraphQL API) or not
   */
  public?: utils.OptionalFlag;
}

export abstract class AbstractMutation<
    TRequestContext extends object,
    TArgs extends utils.Nillable<utils.PlainObject>,
    TResult,
  >
  extends AbstractOperation<TRequestContext, TArgs, TResult>
  implements MutationInterface<TRequestContext>
{
  public override readonly operationType = graphql.OperationTypeNode.MUTATION;
  public abstract readonly mutationTypes: ReadonlyArray<utils.MutationType>;

  @Memoize()
  public override isEnabled(): boolean {
    return this.mutationTypes.every((mutationType) =>
      this.node.isMutationEnabled(mutationType),
    );
  }

  @Memoize()
  public override isPublic(): boolean {
    return (
      this.isEnabled() &&
      this.mutationTypes.every((mutationType) =>
        this.node.isMutationPublic(mutationType),
      )
    );
  }

  protected override ensureAuthorization(
    context: MutationContext,
    path: utils.Path,
  ): NodeFilter | undefined {
    return this.mutationTypes.reduce<NodeFilter | undefined>(
      (authorization, mutationType) =>
        new NodeFilter(
          this.node,
          new AndOperation([
            authorization?.filter,
            context.ensureAuthorization(this.node, path, mutationType)?.filter,
          ]),
        ).normalized,
      super.ensureAuthorization(context, path),
    );
  }

  protected abstract override executeWithValidArgumentsAndContext(
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<TArgs>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<TResult>;

  public override async execute(
    args: TArgs,
    context: TRequestContext | MutationContext<TRequestContext>,
    path: utils.Path = utils.addPath(
      utils.addPath(undefined, this.operationType),
      this.name,
    ),
  ): Promise<TResult> {
    if (context instanceof MutationContext) {
      return super.execute(args, context, path);
    }

    this.assertIsEnabled(path);

    const mutationContext = new MutationContext(this.gp, context);

    const authorization = this.ensureAuthorization(mutationContext, path);

    const parsedArguments = this.parseArguments(
      {
        ...args,
        // For the mutations, it is allowed to forget the "selection" as we may don't need the result
        ...(args?.selection == null && this.selectionAware
          ? { selection: this.node.identifier.selection }
          : {}),
      },
      mutationContext,
      path,
    );

    try {
      await this.connector.preMutation?.(mutationContext);
    } catch (error) {
      throw new ConnectorError({ cause: error, path });
    }

    let result: TResult;

    try {
      result = await this.executeWithValidArgumentsAndContext(
        authorization,
        parsedArguments,
        mutationContext,
        path,
      );

      try {
        await this.connector.postSuccessfulMutation?.(mutationContext);
      } catch (error) {
        throw new ConnectorError({ cause: error, path });
      }

      // changes
      {
        const committedAt = new Date();

        mutationContext.changes.forEach((change) => {
          change.committedAt = committedAt;
        });
      }
    } catch (error) {
      try {
        await this.connector.postFailedMutation?.(
          mutationContext,
          utils.castToError(error),
        );
      } catch (error) {
        throw new ConnectorError({ cause: error, path });
      }

      throw error;
    } finally {
      try {
        await this.connector.postMutation?.(mutationContext);
      } catch (error) {
        throw new ConnectorError({ cause: error, path });
      }
    }

    // changes
    {
      const aggregation = new NodeChangeAggregation(mutationContext.changes);

      if (aggregation.length) {
        await Promise.all(
          Array.from(aggregation, (change) =>
            this.gp.emit('node-change', change),
          ),
        );
      }
    }

    return result;
  }
}
