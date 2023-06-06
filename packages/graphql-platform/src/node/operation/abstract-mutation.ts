import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { CamelCase } from 'type-fest';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import {
  AbstractOperation,
  type NodeSelectionAwareArgs,
} from '../abstract-operation.js';
import { AndOperation, NodeFilter } from '../statement/filter.js';
import type { ContextBoundAPI } from './api.js';
import { ConnectorWorkflowKind, catchConnectorWorkflowError } from './error.js';
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
   * The "context"-bound API, so you only have to provide the operations' args:
   *
   * @example <caption>GraphAPI</caption>
   * const articles = await api.query.articles({ where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   *
   * @example <caption>NodeAPI</caption>
   * const articles = await api.Article.findMany({ where: { status: ArticleStatus.Published }, first: 5, selection: `{ id title }` });
   */
  api: ContextBoundAPI;
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
  public readonly operationType = graphql.OperationTypeNode.MUTATION;
  public abstract readonly mutationTypes: ReadonlyArray<utils.MutationType>;

  @Memoize()
  public get method(): CamelCase<this['key']> {
    return this.key.replaceAll(/((?:-).)/g, ([_match, letter]) =>
      letter.toUpperCase(),
    ) as any;
  }

  @Memoize()
  public override isEnabled(): boolean {
    return this.mutationTypes.every((mutationType) =>
      this.node.isMutable(mutationType),
    );
  }

  @Memoize()
  public override isPublic(): boolean {
    return (
      this.isEnabled() &&
      this.mutationTypes.every((mutationType) =>
        this.node.isPubliclyMutable(mutationType),
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
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<TArgs>,
    path: utils.Path,
  ): Promise<TResult>;

  public override async execute(
    context: TRequestContext | MutationContext<TRequestContext>,
    args: TArgs,
    path: utils.Path = utils.addPath(
      utils.addPath(undefined, this.operationType),
      this.name,
    ),
  ): Promise<TResult> {
    if (context instanceof MutationContext) {
      return super.execute(context, args, path);
    }

    this.assertIsEnabled(path);

    this.gp.assertRequestContext(context, path);

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

    await catchConnectorWorkflowError(
      () => this.connector.preMutation?.(mutationContext),
      ConnectorWorkflowKind.PRE_MUTATION,
      { path },
    );

    let result: TResult;

    try {
      result = await this.executeWithValidArgumentsAndContext(
        mutationContext,
        authorization,
        parsedArguments,
        path,
      );

      await catchConnectorWorkflowError(
        () => this.connector.postSuccessfulMutation?.(mutationContext),
        ConnectorWorkflowKind.POST_SUCCESSFUL_MUTATION,
        { path },
      );

      mutationContext.commitChanges();
    } catch (rawError) {
      const error = utils.castToError(rawError);

      await catchConnectorWorkflowError(
        () => this.connector.postFailedMutation?.(mutationContext, error),
        ConnectorWorkflowKind.POST_FAILED_MUTATION,
        { path },
      );

      throw error;
    } finally {
      await catchConnectorWorkflowError(
        () => this.connector.postMutation?.(mutationContext),
        ConnectorWorkflowKind.POST_MUTATION,
        { path },
      );
    }

    // changes
    {
      const aggregation = mutationContext.aggregateChanges();

      if (aggregation.length) {
        await Promise.all([
          this.gp.emit('node-change-aggregation', aggregation),
          this.gp.eventListenerCount('node-change')
            ? Promise.all(
                Array.from(aggregation, (change) =>
                  this.gp.emit('node-change', change),
                ),
              )
            : undefined,
        ]);
      }
    }

    return result;
  }
}
