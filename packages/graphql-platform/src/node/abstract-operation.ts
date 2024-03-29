import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import * as R from 'remeda';
import type { Merge } from 'type-fest';
import type { BrokerInterface } from '../broker-interface.js';
import type { ConnectorInterface } from '../connector-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type { Node } from '../node.js';
import { OperationContext } from './operation/context.js';
import {
  InvalidArgumentsError,
  InvalidSelectionError,
} from './operation/error.js';
import type { NodeFilter } from './statement/filter.js';
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
  TRequestContext extends object = any,
  TConnector extends ConnectorInterface = any,
  TBroker extends BrokerInterface = any,
  TContainer extends object = any,
  TArgs extends utils.Nillable<utils.PlainObject> = any,
  TResult = any,
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

  public isEnabled(): boolean {
    return true;
  }

  @Memoize()
  public isPublic(): boolean {
    return this.isEnabled() && this.node.isPublic();
  }

  @Memoize()
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

  protected assertIsEnabled(path: utils.Path): void {
    if (!this.isEnabled()) {
      throw new utils.GraphError(
        `The "${this}" ${this.operationType} is disabled`,
        { path },
      );
    }
  }

  protected ensureAuthorization(
    context: OperationContext,
    path: utils.Path,
  ): NodeFilter | undefined {
    return context.ensureAuthorization(this.node, path);
  }

  /**
   * Optional, the arguments of the operation
   */
  public get arguments(): ReadonlyArray<utils.Input> | undefined {
    return;
  }

  protected parseArguments(
    context: OperationContext,
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
      throw new InvalidArgumentsError({ cause, path });
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
        throw new InvalidSelectionError({ cause, path });
      }
    }

    return parsedArgs as any;
  }

  /**
   * The actual implementation with authorization, parsed arguments and context
   */
  protected abstract executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<TArgs>,
    path: utils.Path,
  ): TResult;

  public internal(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: TArgs,
    path: utils.Path,
  ): TResult {
    this.assertIsEnabled(path);

    const parsedArguments = this.parseArguments(context, args, path);

    return this.executeWithValidArgumentsAndContext(
      context,
      authorization,
      parsedArguments,
      path,
    );
  }

  public execute(
    context: TRequestContext | OperationContext,
    args: TArgs,
    path: utils.Path = utils.addPath(
      utils.addPath(undefined, this.operationType),
      this.name,
    ),
  ): TResult {
    this.assertIsEnabled(path);

    let operationContext: OperationContext;

    if (context instanceof OperationContext) {
      assert.equal(context.gp, this.gp);

      operationContext = context;
    } else {
      this.gp.assertRequestContext(context, path);

      operationContext = new OperationContext(this.gp, context) as any;
    }

    const authorization = this.ensureAuthorization(operationContext, path);

    return this.internal(operationContext, authorization, args, path);
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

    const subscriber = this.getGraphQLFieldConfigSubscriber();
    const resolver = this.getGraphQLFieldConfigResolver();

    return {
      ...(this.description && { description: this.description }),
      ...(this.node.deprecationReason && {
        deprecationReason: this.node.deprecationReason,
      }),
      ...(this.arguments?.length && {
        args: utils.getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.getGraphQLFieldConfigType(),
      ...(subscriber && { subscribe: subscriber }),
      ...(resolver && { resolve: resolver }),
    };
  }
}
