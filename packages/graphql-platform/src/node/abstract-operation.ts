import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import _ from 'lodash';
import assert from 'node:assert/strict';
import type { Merge } from 'type-fest';
import type { ConnectorInterface } from '../connector-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type { Node } from '../node.js';
import { OperationContext } from './operation/context.js';
import {
  ConnectorError,
  InternalError,
  LifecycleHookError,
} from './operation/error.js';
import type { OperationInterface } from './operation/interface.js';
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
> = Readonly<
  Exclude<
    TArgs extends { selection: RawNodeSelection }
      ? Merge<TArgs, { selection: NodeSelection }>
      : TArgs,
    null
  >
>;

export abstract class AbstractOperation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> implements OperationInterface<TRequestContext, TConnector>
{
  protected readonly gp: GraphQLPlatform<TRequestContext, TConnector>;

  protected abstract readonly selectionAware: TArgs extends {
    selection: RawNodeSelection;
  }
    ? true
    : false;

  public abstract readonly operationType: graphql.OperationTypeNode;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly arguments: ReadonlyArray<utils.Input>;

  public constructor(public readonly node: Node<TRequestContext, TConnector>) {
    this.gp = node.gp;
  }

  public toString(): string {
    return this.name;
  }

  @Memoize()
  public isEnabled(): boolean {
    return true;
  }

  @Memoize()
  public isPublic(): boolean {
    return this.isEnabled() && this.node.isPublic();
  }

  @Memoize()
  public validate(): void {
    this.operationType;
    this.name;
    this.description;

    if (this.arguments.length) {
      utils.aggregateConfigError<utils.Input, void>(
        this.arguments,
        (_, argument) => argument.validate(),
        undefined,
        { path: this.node.configPath },
      );
    }

    this.isEnabled();

    if (this.isPublic()) {
      this.getGraphQLFieldConfig();
    }
  }

  protected get connector(): TConnector {
    return this.gp.connector;
  }

  protected assertIsEnabled(path: utils.Path): void {
    if (!this.isEnabled()) {
      throw new utils.NestableError(
        `The "${this}" ${this.operationType} is disabled`,
        { path },
      );
    }
  }

  protected ensureAuthorization(
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): NodeFilter<TRequestContext, TConnector> | undefined {
    return context.ensureAuthorization(this.node, path);
  }

  protected parseArguments(
    args: TArgs,
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): NodeSelectionAwareArgs<TArgs> {
    const parsedArgs = utils.parseInputValues(
      this.arguments,
      this.selectionAware && utils.isPlainObject(args)
        ? _.omit(args, ['selection'])
        : args,
      utils.addPath(path, argsPathKey),
    );

    if (this.selectionAware) {
      Object.assign(parsedArgs, {
        selection: this.node.outputType.select(
          args?.selection,
          context,
          undefined,
          path,
        ),
      });
    }

    return parsedArgs as any;
  }

  /**
   * The actual implementation with authorization, parsed arguments and context
   */
  protected abstract executeWithValidArgumentsAndContext(
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: NodeSelectionAwareArgs<TArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<TResult>;

  public async internal(
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: TArgs,
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<TResult> {
    this.assertIsEnabled(path);

    const parsedArguments = this.parseArguments(args, context, path);

    return this.executeWithValidArgumentsAndContext(
      authorization,
      parsedArguments,
      context,
      path,
    );
  }

  public async execute(
    args: TArgs,
    context: TRequestContext | OperationContext<TRequestContext, TConnector>,
    path: utils.Path = utils.addPath(
      utils.addPath(undefined, this.operationType),
      this.name,
    ),
  ): Promise<TResult> {
    this.assertIsEnabled(path);

    const operationContext =
      context instanceof OperationContext
        ? context
        : new OperationContext(this.gp, context);

    const authorization = this.ensureAuthorization(operationContext, path);

    return this.internal(authorization, args, operationContext, path);
  }

  public abstract getGraphQLOutputType(): graphql.GraphQLOutputType;

  public getGraphQLFieldConfig(): graphql.GraphQLFieldConfig<
    undefined,
    TRequestContext,
    Omit<TArgs, 'selection'>
  > {
    assert(this.isPublic(), `The "${this}" ${this.operationType} is private`);

    return {
      ...(this.description && { description: this.description }),
      ...(this.node.deprecationReason && {
        deprecationReason: this.node.deprecationReason,
      }),
      ...(this.arguments.length && {
        args: utils.getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.getGraphQLOutputType(),
      resolve: async (_, args, context, info) => {
        try {
          return await this.execute(
            (this.selectionAware
              ? { ...args, selection: info }
              : args) as TArgs,
            context,
            info.path,
          );
        } catch (error) {
          throw utils.isConfigError(error) ||
            error instanceof ConnectorError ||
            error instanceof LifecycleHookError
            ? new InternalError({ path: info.path, cause: error })
            : error;
        }
      },
    };
  }
}
