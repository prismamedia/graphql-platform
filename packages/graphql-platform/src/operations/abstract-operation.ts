import {
  addPath,
  getOptionalFlagValue,
  getResolverPath,
  GraphQLArgumentConfigMap,
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
  OperationTypeNode,
} from 'graphql';
import { Merge } from 'type-fest';
import { IConnector } from '../connector';
import {
  Node,
  parseResolverSelections,
  parseSelections,
  TFieldSelection,
  TSelections,
} from '../node';
import { OperationContext } from './context';

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
  ? Omit<TArgs, 'selections'>
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

export abstract class AbstractOperation<
  TArgs extends TOperationArgs,
  TResult,
  TConfig extends IOperationConfig
> {
  public abstract readonly type: OperationTypeNode;
  public abstract readonly name: string;
  public abstract readonly description?: string;

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
    const isPublic = getOptionalFlagValue(
      this.config?.public,
      this.enabled && this.node.public,
    );

    assert(
      !isPublic || this.enabled,
      `The "${this.name}" operation cannot be public as it is disabled`,
    );

    assert(
      !isPublic || this.node.public,
      `The "${this.name}" operation cannot be public as its node is not`,
    );

    return isPublic;
  }

  protected abstract doExecute(
    args: TWithParsedSelectionsOperationArgs<TArgs>,
    operationContext: OperationContext<any, IConnector>,
    path?: Path,
  ): Promise<TResult>;

  public async execute<TContext>(
    args: TArgs,
    context?: TContext | OperationContext<TContext>,
    path?: Path,
  ): Promise<TResult> {
    if (!(args === undefined || isPlainObject(args))) {
      throw new UnexpectedValueError(args, `an object`, addPath(path, 'args'));
    }

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

    try {
      const result = await this.doExecute(
        <TWithParsedSelectionsOperationArgs<TArgs>>{
          ...args,
          ...(args.selections && {
            selections: parseSelections(this.node, args.selections, path),
          }),
        },
        operationContext,
        path,
      );

      if (operationContext !== context) {
        await operationContext.connector.onSuccess?.(operationContext);

        // Fire/emit the events
        operationContext.postSuccessEvents.map((postSuccessEvent) =>
          postSuccessEvent(),
        );
      }

      return result;
    } catch (error) {
      if (operationContext !== context) {
        await operationContext.connector.onFailure?.(operationContext);
      }

      throw error;
    }
  }

  protected abstract get graphqlFieldConfigArgs(): TOperationFieldArgs<TArgs>;

  protected abstract get graphqlFieldConfigType(): GraphQLOutputType;

  public get graphqlFieldConfig(): GraphQLFieldConfig<undefined, any, TArgs> {
    assert(this.public, `The "${this}" operation is private`);

    const args = this.graphqlFieldConfigArgs;
    const type = this.graphqlFieldConfigType;
    const isSelectionsAware = getNamedType(type).name === this.node.type.name;

    return {
      description: this.description,
      args,
      type,
      resolve: async (_, args, context, info) => {
        const path = getResolverPath(info);

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
