import * as opentelemetry from '@opentelemetry/api';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { CamelCase } from 'type-fest';
import type { BrokerInterface } from '../../broker-interface.js';
import type { ConnectorInterface } from '../../connector-interface.js';
import type { GraphQLPlatform } from '../../index.js';
import { trace } from '../../instrumentation.js';
import type { Node } from '../../node.js';
import { AbstractOperation } from '../abstract-operation.js';
import { AndOperation, NodeFilter, TrueValue } from '../statement/filter.js';
import type { ContextBoundAPI } from './api.js';
import { MutationContext } from './mutation/context.js';

export interface AbstractMutationHookArgs<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
> {
  /**
   * The GraphQL-Platform instance
   */
  gp: GraphQLPlatform<TRequestContext, TConnector, TBroker, TContainer>;

  /**
   * The node's definition
   */
  node: Node<TRequestContext, TConnector, TBroker, TContainer>;

  /**
   * The current context
   */
  context: MutationContext<TRequestContext, TConnector, TBroker, TContainer>;

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
  TBroker extends BrokerInterface,
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
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = any,
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
> extends AbstractOperation<
  TArgs,
  Promise<TResult>,
  TRequestContext,
  TConnector,
  TBroker,
  TContainer,
  MutationContext<TRequestContext, TConnector, TBroker, TContainer>
> {
  public readonly operationType = graphql.OperationTypeNode.MUTATION;
  public abstract readonly mutationTypes: ReadonlyArray<utils.MutationType>;

  @MGetter
  public get method(): CamelCase<this['key']> {
    return this.key.replaceAll(/((?:-).)/g, ([_match, letter]) =>
      letter.toUpperCase(),
    ) as any;
  }

  @MMethod()
  public override isEnabled(): boolean {
    return this.mutationTypes.every((mutationType) =>
      this.node.isMutable(mutationType),
    );
  }

  @MMethod()
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
    return new NodeFilter(
      this.node,
      AndOperation.create([
        super.ensureAuthorization(context, path)?.filter ?? TrueValue,
        ...this.mutationTypes.map(
          (mutationType) =>
            context.ensureAuthorization(this.node, path, mutationType)
              ?.filter ?? TrueValue,
        ),
      ]),
    ).normalized;
  }

  public override async execute(
    context: TRequestContext | MutationContext,
    args: TArgs,
    path?: utils.Path,
  ): Promise<TResult> {
    const name: string = `operation.${this.node}.${this.operationType}.${this.key}`;
    const attributes: opentelemetry.Attributes = {
      'operation.node': this.node.name,
      'operation.type': this.operationType,
      'operation.key': this.key,
      'mutation.types': [...this.mutationTypes],
    };

    return context instanceof MutationContext
      ? trace(name, () => super.execute(context, args, path), { attributes })
      : trace(
          name,
          () =>
            this.gp.withMutationContext(
              context,
              (context) => super.execute(context, args, path),
              path,
            ),
          { kind: opentelemetry.SpanKind.SERVER, attributes },
        );
  }

  protected getGraphQLFieldConfigSubscriber(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['subscribe'] {
    return undefined;
  }

  protected getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'] {
    return (_, args, context, info) =>
      utils
        .PromiseTry(
          this.execute.bind(
            this,
            context,
            (this.selectionAware
              ? { ...args, selection: info }
              : args) as TArgs,
            info.path,
          ),
        )
        .catch((error) => {
          throw utils.isGraphError(error) ? error.toGraphQLError() : error;
        });
  }
}
