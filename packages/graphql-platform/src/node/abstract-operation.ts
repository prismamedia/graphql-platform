import * as utils from '@prismamedia/graphql-platform-utils';
import { MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert';
import * as R from 'remeda';
import type { Merge } from 'type-fest';
import type { BrokerInterface } from '../broker-interface.js';
import type { ConnectorInterface } from '../connector-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type { Node } from '../node.js';
import type { OperationContext } from './operation/context.js';
import {
  InvalidArgumentsError,
  InvalidSelectionError,
  OperationError,
  RequestErrorCode,
} from './operation/error.js';
import { AndOperation, NodeFilter } from './statement/filter.js';
import type { NodeSelection } from './statement/selection.js';
import type { RawNodeSelection } from './type/output/node.js';

export const argsPathKey: utils.Path['key'] = '@args';

export type RawNodeSelectionAwareArgs<
  TArgs extends utils.Nillable<utils.PlainObject>,
> = TArgs & {
  selection: RawNodeSelection;
};

export type NodeSelectionAwareArgs<
  TArgs extends utils.Nillable<utils.PlainObject>,
> = Exclude<
  TArgs extends { selection: RawNodeSelection }
    ? Merge<TArgs, { selection: NodeSelection }>
    : TArgs,
  null
>;

export abstract class AbstractOperation<
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TBroker extends BrokerInterface,
  TContainer extends object,
  TOperationContext extends OperationContext,
> {
  protected readonly gp: GraphQLPlatform<
    TRequestContext,
    TConnector,
    TBroker,
    TContainer
  >;

  protected abstract readonly selectionAware: TArgs extends {
    selection: unknown;
  }
    ? true
    : false;

  public abstract readonly operationType: graphql.OperationTypeNode;
  public abstract readonly mutationTypes?: ReadonlyArray<utils.MutationType>;

  /**
   * This is unique for a node/operation-type
   *
   * It identifies the operation for a given node and operation-type
   */
  public abstract readonly key: string & {};

  /**
   * This is unique for a node
   *
   * It identifies the operation for a given node
   */
  public abstract readonly method: string;

  /**
   * This is unique
   *
   * It identifies the operation
   */
  public abstract readonly name: string;

  /**
   * Optional, a user-friendly description
   */
  public readonly description?: string;

  public constructor(
    public readonly node: Node<
      TRequestContext,
      TConnector,
      TBroker,
      TContainer
    >,
  ) {
    this.gp = node.gp;
  }

  protected get connector(): TConnector {
    return this.gp.connector;
  }

  protected get broker(): TBroker {
    return this.gp.broker;
  }

  protected get container(): TContainer {
    return this.gp.container;
  }

  public toString(): string {
    return this.name;
  }

  @MMethod()
  public isEnabled(): boolean {
    return (
      !this.mutationTypes?.length ||
      this.mutationTypes.every((mutationType) =>
        this.node.isMutable(mutationType),
      )
    );
  }

  @MMethod()
  public isPublic(): boolean {
    return (
      this.isEnabled() &&
      this.node.isPublic() &&
      (!this.mutationTypes?.length ||
        this.mutationTypes.every((mutationType) =>
          this.node.isPubliclyMutable(mutationType),
        ))
    );
  }

  @MMethod()
  public validate(): void {
    if (!this.isEnabled()) {
      return;
    }

    this.operationType;
    this.name;
    this.description;

    if (this.arguments?.length) {
      utils.aggregateGraphError<utils.Input, void>(
        this.arguments,
        (_, argument) => argument.validate(),
        undefined,
        { path: this.node.configPath },
      );
    }

    if (this.isPublic()) {
      this.getGraphQLFieldConfig();
    }
  }

  protected assertIsEnabled(
    context: TOperationContext,
    path: utils.Path,
  ): void {
    if (!this.isEnabled()) {
      throw new OperationError(context.request, this.node, {
        mutationType: this.mutationTypes?.[0],
        code: RequestErrorCode.DISABLED,
        path,
      });
    }
  }

  protected ensureAuthorization(
    context: TOperationContext,
    path: utils.Path,
  ): NodeFilter | undefined {
    return this.mutationTypes?.length
      ? new NodeFilter(
          this.node,
          AndOperation.create(
            R.filter(
              [
                context.ensureAuthorization(this.node, path)?.filter,
                ...this.mutationTypes.map(
                  (mutationType) =>
                    context.ensureAuthorization(this.node, path, mutationType)
                      ?.filter,
                ),
              ],
              R.isDefined,
            ),
          ),
        ).normalized
      : context.ensureAuthorization(this.node, path);
  }

  /**
   * Optional, the arguments of the operation
   */
  public get arguments(): ReadonlyArray<utils.Input> | undefined {
    return;
  }

  public parseArguments(
    context: TOperationContext,
    args: TArgs,
    path: utils.Path,
  ): NodeSelectionAwareArgs<TArgs> {
    let parsedArgs;

    try {
      parsedArgs = utils.parseInputValues(
        this.arguments ?? [],
        this.selectionAware && utils.isPlainObject(args)
          ? R.omit(args, ['selection'])
          : args,
        utils.addPath(path, argsPathKey),
      );
    } catch (cause) {
      throw new InvalidArgumentsError(context.request, this.node, {
        cause,
        path,
      });
    }

    if (this.selectionAware) {
      try {
        Object.assign(parsedArgs, {
          selection: this.node.outputType.select(
            args?.selection,
            context,
            undefined,
            path,
          ),
        });
      } catch (cause) {
        throw new InvalidSelectionError(context.request, this.node, {
          cause,
          path,
        });
      }
    }

    return parsedArgs as any;
  }

  /**
   * The actual implementation with authorization, parsed arguments and context
   */
  protected abstract executeWithValidArgumentsAndContext(
    context: TOperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<TArgs>,
    path: utils.Path,
  ): TResult;

  public internal(
    context: TOperationContext,
    authorization: NodeFilter | undefined,
    args: TArgs,
    path: utils.Path,
  ): TResult {
    this.assertIsEnabled(context, path);

    const parsedArguments = this.parseArguments(context, args, path);

    return this.executeWithValidArgumentsAndContext(
      context,
      authorization,
      parsedArguments,
      path,
    );
  }

  public execute(
    context: TOperationContext,
    args: TArgs,
    path: utils.Path = utils.addPath(
      utils.addPath(undefined, this.operationType),
      this.name,
    ),
  ): TResult {
    this.assertIsEnabled(context, path);

    const authorization = this.ensureAuthorization(context, path);

    return this.internal(context, authorization, args, path);
  }

  public abstract getGraphQLFieldConfigType(): graphql.GraphQLOutputType;

  protected abstract getGraphQLFieldConfigSubscriber(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['subscribe'];

  protected abstract getGraphQLFieldConfigResolver(): graphql.GraphQLFieldConfig<
    any,
    TRequestContext,
    Omit<TArgs, 'selection'>
  >['resolve'];

  public getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  > {
    assert(this.isPublic(), `The "${this}" ${this.operationType} is private`);

    const subscribe = this.getGraphQLFieldConfigSubscriber();
    const resolve = this.getGraphQLFieldConfigResolver();

    return {
      ...(this.description && { description: this.description }),
      ...(this.node.deprecationReason && {
        deprecationReason: this.node.deprecationReason,
      }),
      ...(this.arguments?.length && {
        args: utils.getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.getGraphQLFieldConfigType(),
      ...(subscribe && { subscribe }),
      ...(resolve && { resolve }),
    };
  }
}
