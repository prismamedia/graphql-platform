import {
  addPath,
  aggregateConfigError,
  getGraphQLFieldConfigArgumentMap,
  isPlainObject,
  parseInputs,
  type Input,
  type Nillable,
  type Path,
  type PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import _ from 'lodash';
import assert from 'node:assert/strict';
import type { Merge } from 'type-fest';
import type { ConnectorInterface } from '../connector-interface.js';
import type { GraphQLPlatform } from '../index.js';
import type { Node } from '../node.js';
import { OperationContext } from './operation/context.js';
import { RuntimeError } from './operation/error.js';
import type { OperationInterface } from './operation/interface.js';
import type { NodeSelection } from './statement/selection.js';
import type { RawNodeSelection } from './type/output/node.js';

export const argsPathKey: Path['key'] = '@args';

export type RawNodeSelectionAwareArgs<TArgs extends Nillable<PlainObject>> =
  TArgs & {
    selection: RawNodeSelection;
  };

export type NodeSelectionAwareArgs<TArgs extends Nillable<PlainObject>> =
  Readonly<
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
  TArgs extends Nillable<PlainObject>,
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
  public abstract readonly arguments: ReadonlyArray<Input>;

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
      aggregateConfigError<Input, void>(
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

  protected assertIsEnabled(path: Path): void {
    if (!this.isEnabled()) {
      throw new RuntimeError(
        `The "${this.name}" ${this.operationType} is disabled`,
        { path },
      );
    }
  }

  protected assertAuthorization(
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): void {
    context.getNodeAuthorization(this.node, path);
  }

  protected parseArguments(
    args: TArgs,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): NodeSelectionAwareArgs<TArgs> {
    const parsedArgs = parseInputs(
      this.arguments,
      this.selectionAware && isPlainObject(args)
        ? _.omit(args, ['selection'])
        : args,
      addPath(path, argsPathKey),
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

    return Object.freeze<any>(parsedArgs);
  }

  /**
   * The actual implementation with valid arguments and context
   */
  protected abstract executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<TArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<TResult>;

  public async execute(
    args: TArgs,
    context: TRequestContext | OperationContext<TRequestContext, TConnector>,
    path: Path = addPath(addPath(undefined, this.operationType), this.name),
  ): Promise<TResult> {
    this.assertIsEnabled(path);

    const operationContext =
      context instanceof OperationContext
        ? context
        : new OperationContext(this.gp, context);

    this.assertAuthorization(operationContext, path);

    const parsedArguments = this.parseArguments(args, operationContext, path);

    return this.executeWithValidArgumentsAndContext(
      parsedArguments,
      operationContext,
      path,
    );
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
        args: getGraphQLFieldConfigArgumentMap(this.arguments),
      }),
      type: this.getGraphQLOutputType(),
      resolve: (_, args, context, info) =>
        this.execute(
          <TArgs>(this.selectionAware ? { ...args, selection: info } : args),
          context,
          info.path,
        ),
    };
  }
}
