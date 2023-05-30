import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import _ from 'lodash';
import assert from 'node:assert/strict';
import type { Merge } from 'type-fest';
import type { ConnectorInterface } from '../connector-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type { Node } from '../node.js';
import { OperationContext } from './operation/context.js';
import {
  InvalidArgumentsError,
  InvalidSelectionError,
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
> = Exclude<
  TArgs extends { selection: RawNodeSelection }
    ? Merge<TArgs, { selection: NodeSelection }>
    : TArgs,
  null
>;

export abstract class AbstractOperation<
  TRequestContext extends object,
  TArgs extends utils.Nillable<utils.PlainObject>,
  TResult,
> implements OperationInterface<TRequestContext>
{
  protected readonly gp: GraphQLPlatform;

  protected abstract readonly selectionAware: TArgs extends {
    selection: RawNodeSelection;
  }
    ? true
    : false;

  public abstract readonly operationType: graphql.OperationTypeNode;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly arguments?: ReadonlyArray<utils.Input>;

  public constructor(public readonly node: Node) {
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

    if (this.arguments?.length) {
      utils.aggregateGraphError<utils.Input, void>(
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

  protected get connector(): ConnectorInterface {
    return this.gp.connector;
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

  protected parseArguments(
    args: TArgs,
    context: OperationContext,
    path: utils.Path,
  ): NodeSelectionAwareArgs<TArgs> {
    let parsedArgs;

    try {
      parsedArgs = utils.parseInputValues(
        this.arguments || [],
        this.selectionAware && utils.isPlainObject(args)
          ? _.omit(args, ['selection'])
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
  ): Promise<TResult>;

  public async internal(
    context: OperationContext<TRequestContext>,
    authorization: NodeFilter | undefined,
    args: TArgs,
    path: utils.Path,
  ): Promise<TResult> {
    this.assertIsEnabled(path);

    const parsedArguments = this.parseArguments(args, context, path);

    return this.executeWithValidArgumentsAndContext(
      context,
      authorization,
      parsedArguments,
      path,
    );
  }

  public async execute(
    context: TRequestContext | OperationContext<TRequestContext>,
    args: TArgs,
    path: utils.Path = utils.addPath(
      utils.addPath(undefined, this.operationType),
      this.name,
    ),
  ): Promise<TResult> {
    this.assertIsEnabled(path);

    const operationContext =
      context instanceof OperationContext
        ? context
        : new OperationContext(this.gp, context, path);

    const authorization = this.ensureAuthorization(operationContext, path);

    return this.internal(operationContext, authorization, args, path);
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
      ...(this.arguments?.length && {
        args: utils.getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.getGraphQLOutputType(),
      resolve: async (_, args, context, info) => {
        try {
          return await this.execute(
            context,
            (this.selectionAware
              ? { ...args, selection: info }
              : args) as TArgs,
            info.path,
          );
        } catch (error) {
          throw error instanceof utils.GraphError
            ? error.toGraphQLError()
            : error;
        }
      },
    };
  }
}
