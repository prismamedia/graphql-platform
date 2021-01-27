import {
  addPath,
  GraphQLArgumentConfigMap,
  isPlainObject,
  MaybePathAwareError,
  Path,
  PlainObject,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import {
  getNamedType,
  GraphQLFieldConfig,
  GraphQLOutputType,
  OperationTypeNode,
} from 'graphql';
import { Merge } from 'type-fest';
import { ConnectorInterface } from '../../connector';
import { Model } from '../../model';
import {
  NodeSelection,
  parseResolveInfo,
  RawNodeSelection,
} from '../types/node';
import { OperationContext } from './context';

export type RawNodeSelectionAware = {
  selection: RawNodeSelection;
};

export function isRawNodeSelectionAware(
  maybeRawNodeSelectionAware: unknown,
): maybeRawNodeSelectionAware is RawNodeSelectionAware {
  return (
    isPlainObject(maybeRawNodeSelectionAware) &&
    'selection' in maybeRawNodeSelectionAware
  );
}

export type SelectionAware<TArgs extends PlainObject | undefined> =
  TArgs extends RawNodeSelectionAware
    ? Merge<TArgs, { selection: NodeSelection }>
    : TArgs;

export abstract class AbstractOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
  TArgs extends PlainObject | undefined,
  TResult,
> {
  public abstract readonly type: OperationTypeNode;
  public abstract readonly name: string;
  public abstract readonly description: string;

  public constructor(
    public readonly model: Model<TRequestContext, TConnector>,
  ) {}

  public toString(): string {
    return this.name;
  }

  public get enabled(): boolean {
    return true;
  }

  public get public(): boolean {
    return this.enabled && this.model.public;
  }

  public get connector(): ConnectorInterface {
    return this.model.gp.connector;
  }

  protected abstract doExecute(
    args: Readonly<SelectionAware<TArgs>>,
    operationContext: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<TResult>;

  public async execute<TInternal extends boolean = false>(
    ...[
      args,
      context,
      path = addPath(addPath(undefined, this.type), this.name),
    ]: TInternal extends true
      ? [
          args: TArgs,
          context:
            | TRequestContext
            | OperationContext<TRequestContext, TConnector>,
          path: Path,
        ]
      : TRequestContext extends undefined
      ? TArgs extends undefined
        ? [
            args?: TArgs,
            context?:
              | TRequestContext
              | OperationContext<TRequestContext, TConnector>,
            path?: Path,
          ]
        : [
            args: TArgs,
            context?:
              | TRequestContext
              | OperationContext<TRequestContext, TConnector>,
            path?: Path,
          ]
      : [
          args: TArgs,
          context:
            | TRequestContext
            | OperationContext<TRequestContext, TConnector>,
          path?: Path,
        ]
  ): Promise<TResult> {
    if (!this.enabled) {
      throw new MaybePathAwareError(
        `The "${this.name}" operation is disabled`,
        path,
      );
    }

    const operationContext: OperationContext<TRequestContext, TConnector> =
      context instanceof OperationContext
        ? context
        : new OperationContext(
            this.model.gp,
            this.type,
            context as TRequestContext,
          );

    if (this.type === 'mutation' && operationContext.type !== 'mutation') {
      throw new MaybePathAwareError(
        `The "${this}" mutation cannot be used in a "${operationContext.type}" context`,
        path,
      );
    }

    if (!(args === undefined || isPlainObject(args))) {
      throw new UnexpectedValueError(
        args,
        `arguments provided as a plain object`,
        path,
      );
    }

    const params: [
      args: Readonly<SelectionAware<TArgs>>,
      operationContext: OperationContext<TRequestContext, TConnector>,
      path: Path,
    ] = [
      <SelectionAware<TArgs>>{
        ...args,
        ...(isRawNodeSelectionAware(args) && {
          selection: this.model.nodeType.select(args.selection, path),
        }),
      },
      operationContext,
      path,
    ];

    if (operationContext !== context) {
      let result: TResult;

      try {
        result = await this.doExecute(...params);

        await this.connector.postSuccessfulOperation?.(operationContext);
      } catch (error) {
        await this.connector.postFailedOperation?.(operationContext);

        throw error;
      } finally {
        await this.connector.postOperation?.(operationContext);

        // Regardless of its success or failure, this context is no longer usable
        operationContext.revoke();
      }

      // Emit the post success events
      operationContext.postSuccessEvents.map((postSuccessEvent) =>
        postSuccessEvent(),
      );

      return result;
    } else {
      return this.doExecute(...params);
    }
  }

  public abstract get graphqlFieldConfigArgs(): GraphQLArgumentConfigMap<
    Omit<TArgs, 'selection'>
  >;

  public abstract get graphqlFieldConfigType(): GraphQLOutputType;

  public get graphqlFieldConfig(): GraphQLFieldConfig<
    undefined,
    TRequestContext,
    TArgs
  > {
    assert(this.public, `The "${this}" operation is private`);

    const type = this.graphqlFieldConfigType;

    const isSelectionAware =
      getNamedType(type).name === this.model.nodeType.name;

    return {
      description: this.description,
      args: this.graphqlFieldConfigArgs,
      type,
      resolve: (_, args, context, info) =>
        this.execute<true>(
          isSelectionAware
            ? {
                ...args,
                ...(isSelectionAware && {
                  selection: parseResolveInfo(
                    this.model.nodeType,
                    info,
                    info.path,
                  ),
                }),
              }
            : args,
          context,
          info.path,
        ),
    };
  }
}
