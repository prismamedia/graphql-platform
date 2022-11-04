import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import {
  AbstractOperation,
  type NodeSelectionAwareArgs,
} from '../abstract-operation.js';
import { AndOperation, NodeFilter } from '../statement/filter.js';
import type { ContextBoundAPI } from './api.js';
import { catchConnectorError } from './error.js';
import { MutationContext } from './mutation/context.js';
import type { MutationInterface } from './mutation/interface.js';

export interface AbstractMutationHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> {
  /**
   * The GraphQL Platform instance
   */
  gp: GraphQLPlatform<TRequestContext, TConnector>;

  /**
   * The node's definition
   */
  node: Node<TRequestContext, TConnector>;

  /**
   * The current context
   */
  context: MutationContext<TRequestContext, TConnector>;

  /**
   * The context-bound API
   */
  api: ContextBoundAPI<TRequestContext, TConnector>;
}

export interface AbstractMutationConfig<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
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
    TConnector extends ConnectorInterface,
    TArgs extends utils.Nillable<utils.PlainObject>,
    TResult,
  >
  extends AbstractOperation<TRequestContext, TConnector, TArgs, TResult>
  implements MutationInterface<TRequestContext, TConnector>
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
    context: MutationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): NodeFilter<TRequestContext, TConnector> | undefined {
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
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: NodeSelectionAwareArgs<TArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<TResult>;

  public override async execute(
    args: TArgs,
    context: TRequestContext | MutationContext<TRequestContext, TConnector>,
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

    if (this.connector.preMutation) {
      await catchConnectorError(
        () => this.connector.preMutation!(mutationContext),
        path,
      );
    }

    let result: TResult;

    try {
      result = await this.executeWithValidArgumentsAndContext(
        authorization,
        parsedArguments,
        mutationContext,
        path,
      );

      if (this.connector.postSuccessfulMutation) {
        await catchConnectorError(
          () => this.connector.postSuccessfulMutation!(mutationContext),
          path,
        );
      }

      // changes
      {
        const committedAt = new Date();

        mutationContext.changes.forEach((change) => {
          change.committedAt = committedAt;
        });
      }
    } catch (error) {
      if (this.connector.postFailedMutation) {
        await catchConnectorError(
          () =>
            this.connector.postFailedMutation!(
              mutationContext,
              utils.castToError(error),
            ),
          path,
        );
      }

      throw error;
    } finally {
      if (this.connector.postMutation) {
        await catchConnectorError(
          () => this.connector.postMutation!(mutationContext),
          path,
        );
      }
    }

    await this.gp.emitChanges(...mutationContext.changes);

    return result;
  }
}
