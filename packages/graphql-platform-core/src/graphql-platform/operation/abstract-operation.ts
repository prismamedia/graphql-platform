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
import { ConnectorInterface } from '../connector';
import { Operation, OperationContext, OperationResolverParams } from '../operation';
import { Resource, ResourceEventKind, ResourceOperationEvent } from '../resource';

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
  public getGraphQLFieldConfig(): GraphQLFieldConfig<any, any, TArgs, TResult> {
    return {
      description: this.description,
      args: this.getGraphQLFieldConfigArgs(),
      type: this.getGraphQLFieldConfigType(),
      resolve: async (_, args, context, info) => {
        const operationContext: OperationContext = {
          postHooks: [],
        };

        const event: ResourceOperationEvent = Object.freeze({
          operation: this,
          context,
          operationContext,
        });

        const selectionNode = parseGraphQLResolveInfo(info);

        try {
          await this.resource.emitSerial(ResourceEventKind.PreOperation, event);

          const params: OperationResolverParams<TArgs> = Object.freeze({
            args,
            context,
            operationContext,
            selectionNode,
          });

          const result = await this.resolve(params);

          await this.resource.emitSerial(ResourceEventKind.PostOperationSuccess, event);

          await Promise.all(operationContext.postHooks.map(async postSuccessHook => postSuccessHook()));

          return result;
        } catch (error) {
          await this.resource.emitSerial(ResourceEventKind.PostOperationError, Object.freeze({ ...event, error }));

          throw error;
        } finally {
          await this.resource.emitSerial(ResourceEventKind.PostOperation, event);
        }
      },
    };
  }
}
