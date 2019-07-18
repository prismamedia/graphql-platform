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
import { Context } from '../../graphql-platform';
import { ConnectorInterface } from '../connector';
import { Operation, OperationEvent, OperationEventKind, OperationResolverParams } from '../operation';
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
  public getGraphQLFieldConfig(): GraphQLFieldConfig<any, Context, TArgs, TResult> {
    return {
      description: this.description,
      args: this.getGraphQLFieldConfigArgs(),
      type: this.getGraphQLFieldConfigType(),
      resolve: async (_, args, context, info) => {
        const selectionNode = parseGraphQLResolveInfo(info);
        const operationContext = context.operationContext;

        if (typeof operationContext.type === 'undefined') {
          operationContext.type = this.type;
        }

        let isRootOperation: boolean = false;

        if (this.type === GraphQLOperationType.Mutation) {
          if (operationContext.type !== GraphQLOperationType.Mutation) {
            throw new Error(
              `A mutation can only be be executed in a mutation, have you tried to executed a mutation through the API binding in a query ?`,
            );
          }

          if (!operationContext.postSuccessHooks) {
            isRootOperation = true;

            operationContext.postSuccessHooks = [];
          }
        }

        const resolverParams: OperationResolverParams<TArgs> = Object.freeze({
          args,
          context,
          selectionNode,
        });

        const event: OperationEvent<TArgs> = Object.freeze({
          ...resolverParams,
          operation: this,
        });

        context.operationEventDataMap.set(event, Object.create(null));

        let success: boolean = false;
        const profile = context.logger && context.logger.startTimer();

        try {
          await this.resource.emitSerial(OperationEventKind.PreOperation, event);

          // Actually resolve the operation
          const result = await this.resolve(resolverParams);

          await this.resource.emitSerial(OperationEventKind.PostOperationSuccess, event);

          success = true;
          profile &&
            profile.done({
              level: 'debug',
              message: `Resolved "${this}" successfully`,
            });

          return result;
        } catch (error) {
          await this.resource.emitSerial(OperationEventKind.PostOperationError, event);

          profile &&
            profile.done({
              level: 'error',
              message: error,
            });

          throw error;
        } finally {
          await this.resource.emitSerial(OperationEventKind.PostOperation, event);

          if (
            operationContext.type === GraphQLOperationType.Mutation &&
            isRootOperation &&
            operationContext.postSuccessHooks
          ) {
            // Execute the hooks on operation success
            if (success) {
              // In case of errors: we log them but do not throw anything as we want the operation remains a "success"
              await Promise.all(
                operationContext.postSuccessHooks.map(async hook => {
                  try {
                    await hook();
                  } catch (error) {
                    context.logger && context.logger.error(error);
                  }
                }),
              );
            }

            delete operationContext.postSuccessHooks;
          }
        }
      },
    };
  }
}
