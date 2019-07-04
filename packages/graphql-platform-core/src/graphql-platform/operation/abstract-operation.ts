import {
  FlagConfig,
  getFlagValue,
  GraphQLFieldConfig,
  GraphQLOperationType,
  parseGraphQLResolveInfo,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLFieldConfigArgumentMap, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { BaseContext } from '../../graphql-platform';
import { ConnectorInterface } from '../connector';
import {
  Operation,
  OperationContext,
  OperationEvent,
  OperationEventKind,
  OperationResolverParams,
  PostOperationSuccessHook,
} from '../operation';
import { Resource } from '../resource';

export abstract class AbstractOperation<TArgs extends POJO = any, TResult = any> implements Operation {
  protected connector: ConnectorInterface;

  public constructor(readonly type: GraphQLOperationType, readonly id: string, readonly resource: Resource) {
    this.connector = resource.gp.getConnector();
  }

  public toString(): string {
    return this.name;
  }

  public abstract get name(): string;

  public abstract get description(): string;

  @Memoize()
  protected getConfig(): FlagConfig {
    const operationsConfig = this.resource.config.operations;
    if (operationsConfig != null) {
      if (typeof operationsConfig === 'boolean') {
        return operationsConfig;
      } else {
        const key =
          this.type === GraphQLOperationType.Mutation
            ? 'mutations'
            : this.type === GraphQLOperationType.Query
            ? 'queries'
            : 'subscriptions';

        const operationsTypeConfig = operationsConfig[key];
        if (operationsTypeConfig != null) {
          if (typeof operationsTypeConfig === 'boolean') {
            return operationsTypeConfig;
          } else {
            const operationConfig = (operationsTypeConfig as any)[this.id];
            if (typeof operationConfig === 'boolean') {
              return operationConfig;
            }
          }
        }
      }
    }

    return undefined;
  }

  public isSupported(): boolean {
    return true;
  }

  @Memoize()
  public isPublic(): boolean {
    return this.isSupported() && getFlagValue(this.getConfig(), true);
  }

  public abstract getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap;

  public abstract getGraphQLFieldConfigType(): GraphQLOutputType;

  public abstract async resolve(params: OperationResolverParams<TArgs>): Promise<TResult>;

  @Memoize()
  public getGraphQLFieldConfig(): GraphQLFieldConfig<any, BaseContext, TArgs, TResult> {
    return {
      description: this.description,
      args: this.getGraphQLFieldConfigArgs(),
      type: this.getGraphQLFieldConfigType(),
      resolve: async (_, args, context, info) => {
        const selectionNode = parseGraphQLResolveInfo(info);

        const postSuccessHooks: PostOperationSuccessHook[] = [];

        const operationContext: OperationContext = { postSuccessHooks };

        const resolverParams: OperationResolverParams<TArgs> = Object.freeze({
          args,
          context,
          selectionNode,
          operationContext,
        });

        const event: OperationEvent<TArgs> = Object.freeze({
          ...resolverParams,
          operation: this,
        });

        try {
          await this.resource.emitSerial(OperationEventKind.PreOperation, event);

          // Actually resolve the operation
          const result = await this.resolve(resolverParams);

          await this.resource.emitSerial(OperationEventKind.PostOperationSuccess, event);

          // Execute the hooks on operation success
          // In case of errors: we log them but do not throw anything as we want the operation remains a "success"
          await Promise.all(
            postSuccessHooks.map(async hook => {
              try {
                await hook();
              } catch (error) {
                context.logger && context.logger.error(error);
              }
            }),
          );

          return result;
        } catch (error) {
          context.logger && context.logger.error(error);
          await this.resource.emitSerial(OperationEventKind.PostOperationError, Object.freeze({ ...event, error }));

          throw error;
        } finally {
          await this.resource.emitSerial(OperationEventKind.PostOperation, event);
        }
      },
    };
  }
}
