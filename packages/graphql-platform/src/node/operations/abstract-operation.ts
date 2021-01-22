import {
  addPath,
  getOptionalFlag,
  GraphQLArgumentConfigMap,
  GraphQLNonNullDecorator,
  isPlainObject,
  MaybePathAwareError,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  getNamedType,
  GraphQLFieldConfig,
  GraphQLOutputType,
  isType,
  OperationTypeNode,
} from 'graphql';
import { pathToArray } from 'graphql/jsutils/Path';
import { Except, Merge } from 'type-fest';
import { IConnector } from '../connector';
import {
  Node,
  parseResolverSelections,
  parseSelections,
  TFieldSelection,
  TSelections,
} from '../node';
import { OperationContext } from './context';
import { NodeNotFoundError } from './errors';

export interface ISelectionsAwareOperationArgs {
  readonly selections: Readonly<TSelections>;
}

export interface ISelectionsUnawareOperationArgs {
  readonly selections?: never;
}

export type TOperationArgs =
  | ISelectionsAwareOperationArgs
  | ISelectionsUnawareOperationArgs;

export type TWithoutSelectionsOperationArgs<
  TArgs extends TOperationArgs
> = TArgs extends ISelectionsAwareOperationArgs
  ? Except<TArgs, 'selections'>
  : TArgs;

export type TWithParsedSelectionsOperationArgs<
  TArgs extends TOperationArgs
> = TArgs extends ISelectionsAwareOperationArgs
  ? Merge<TArgs, { readonly selections: ReadonlyArray<TFieldSelection> }>
  : TArgs;

export type TDefaultOperationArgs<TArgs extends TOperationArgs> = {
  readonly [P in keyof TWithoutSelectionsOperationArgs<TArgs>]?: TWithoutSelectionsOperationArgs<TArgs>[P];
};

export type TOperationFieldArgs<
  TArgs extends TOperationArgs
> = GraphQLArgumentConfigMap<TWithoutSelectionsOperationArgs<TArgs>>;

export interface IOperationConfig {
  /**
   * Optional, the operation can be disabled publicly (= in the GraphQL API)
   */
  readonly public?: boolean;
}

export type TIfExistsOperationResult<
  TResult,
  TOperation extends AbstractOperation<any, any, any>
> = TOperation['ifExists'] extends true ? TResult | null : TResult;

export abstract class AbstractOperation<
  TConfig extends IOperationConfig,
  TArgs extends TOperationArgs,
  TResult
> {
  public abstract readonly type: OperationTypeNode;
  public abstract readonly name: string;
  public abstract readonly description?: string;
  public readonly ifExists: boolean = false;

  public constructor(
    public readonly node: Node,
    public readonly config?: TConfig,
  ) {}

  public toString(): string {
    return this.name;
  }

  public get enabled(): boolean {
    return true;
  }

  @Memoize()
  public get public(): boolean {
    const isPublic = getOptionalFlag(
      this.config?.public,
      this.enabled && this.node.public,
    );

    assert(
      !isPublic || this.enabled,
      `The "${this}" operation cannot be public as it is disabled`,
    );

    assert(
      !isPublic || this.node.public,
      `The "${this}" operation cannot be public as the "${this.node}" node is not`,
    );

    return isPublic;
  }

  protected abstract doExecute(
    args: TWithParsedSelectionsOperationArgs<TArgs>,
    operationContext: OperationContext<any, IConnector>,
    path: Path,
  ): Promise<TResult>;

  public async execute<TContext>(
    args: TArgs,
    context?: TContext | OperationContext<TContext>,
    path: Path = addPath(addPath(undefined, this.type), this.name),
  ): Promise<TIfExistsOperationResult<TResult, this>> {
    if (!this.enabled) {
      throw new MaybePathAwareError(
        `The "${this.name}" operation is disabled`,
        path,
      );
    }

    const operationContext: OperationContext<any, IConnector> =
      context instanceof OperationContext
        ? context
        : new OperationContext(this.node.gp, this.type, context);

    if (this.type === 'mutation' && operationContext.type !== 'mutation') {
      throw new MaybePathAwareError(
        `The "${this.name}" mutation cannot be used in a "${operationContext.type}" context`,
        path,
      );
    }

    if (!(args === undefined || isPlainObject(args))) {
      throw new UnexpectedValueError(args, `arguments provided as object`);
    }

    let result: TResult | null;

    try {
      try {
        result = await this.doExecute(
          <TWithParsedSelectionsOperationArgs<TArgs>>{
            ...args,
            ...(args.selections && {
              selections: parseSelections(this.node, args.selections, path),
            }),
          },
          operationContext,
          path,
        );
      } catch (error) {
        if (error instanceof NodeNotFoundError && this.ifExists) {
          result = null;
        } else {
          throw error;
        }
      }

      if (operationContext !== context) {
        await operationContext.connector.onSuccess?.(operationContext);

        // Fire/emit the events
        operationContext.postSuccessEvents.map((postSuccessEvent) =>
          postSuccessEvent(),
        );
      }
    } catch (error) {
      if (operationContext !== context) {
        await operationContext.connector.onFailure?.(operationContext);
      }

      throw error;
    }

    return result as TIfExistsOperationResult<TResult, this>;
  }

  protected abstract get graphqlFieldConfigArgs(): TOperationFieldArgs<TArgs>;

  protected abstract get graphqlFieldConfigType(): GraphQLOutputType;

  public get graphqlFieldConfig(): GraphQLFieldConfig<undefined, any, TArgs> {
    assert(this.public, `The "${this}" operation is private`);

    const args = this.graphqlFieldConfigArgs;
    const type = GraphQLNonNullDecorator(
      this.graphqlFieldConfigType,
      !this.ifExists,
    );

    const isSelectionsAware =
      isType(type) && getNamedType(type).name === this.node.type.name;

    return {
      description: this.description,
      args,
      type,
      resolve: async (_, args, context, info) => {
        const path = pathToArray(info.path).reduce(addPath, undefined);

        return this.execute(
          <TArgs>(isSelectionsAware
            ? {
                ...args,
                selections: isSelectionsAware
                  ? parseResolverSelections(this.node, info, path)
                  : undefined,
              }
            : args),
          context,
          path,
        );
      },
    };
  }
}
