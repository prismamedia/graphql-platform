import {
  addPath,
  castToError,
  MutationType,
  type Nillable,
  type OptionalFlag,
  type Path,
  type PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import type { Node } from '../../node.js';
import {
  AbstractOperation,
  type NodeSelectionAwareArgs,
} from '../abstract-operation.js';
import type { ContextBoundAPI } from './api.js';
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
  enabled?: OptionalFlag;

  /**
   * Optional, either the mutation is exposed publicly (= in the GraphQL API) or not
   */
  public?: OptionalFlag;
}

export abstract class AbstractMutation<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
    TArgs extends Nillable<PlainObject>,
    TResult,
  >
  extends AbstractOperation<TRequestContext, TConnector, TArgs, TResult>
  implements MutationInterface<TRequestContext, TConnector>
{
  public override readonly operationType = graphql.OperationTypeNode.MUTATION;
  public abstract readonly mutationTypes: ReadonlyArray<MutationType>;

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

  protected override assertAuthorization(
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): void {
    [undefined, ...this.mutationTypes].forEach((mutationType) =>
      context.getNodeAuthorization(this.node, path, mutationType),
    );
  }

  /**
   * The actual implementation with valid arguments and context
   */
  protected abstract override executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<TArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<TResult>;

  public override async execute(
    args: TArgs,
    context: TRequestContext | MutationContext<TRequestContext, TConnector>,
    path: Path = addPath(addPath(undefined, this.operationType), this.name),
  ): Promise<TResult> {
    if (context instanceof MutationContext) {
      return super.execute(args, context, path);
    }

    this.assertIsEnabled(path);

    const mutationContext = new MutationContext(this.gp, context);

    this.assertAuthorization(mutationContext, path);

    const parsedArguments = this.parseArguments(args, mutationContext, path);

    await this.connector.preMutation?.(mutationContext);

    let result: TResult;

    try {
      result = await this.executeWithValidArgumentsAndContext(
        parsedArguments,
        mutationContext,
        path,
      );

      await this.connector.postSuccessfulMutation?.(mutationContext);

      // "Commit" deferred changes in case of success
      mutationContext.commitChanges();
    } catch (error) {
      const castedError = castToError(error);

      await this.connector.postFailedMutation?.(mutationContext, castedError);

      throw castedError;
    } finally {
      await this.connector.postMutation?.(mutationContext);
    }

    return result;
  }
}
