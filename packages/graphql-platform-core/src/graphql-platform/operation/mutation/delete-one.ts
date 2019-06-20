import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { OperationResolverParams } from '../../operation';
import { ResourceHookKind } from '../../resource';
import { NodeSource, TypeKind, WhereUniqueInputValue } from '../../type';
import { AbstractOperation } from '../abstract-operation';

export interface DeleteOneOperationArgs {
  where: WhereUniqueInputValue;
}

export type DeleteOneOperationResult = NodeSource | null;

export class DeleteOneOperation extends AbstractOperation<DeleteOneOperationArgs, DeleteOneOperationResult> {
  @Memoize()
  public isSupported(): boolean {
    return !this.resource.isImmutable();
  }

  @Memoize()
  public get name(): string {
    return `delete${this.resource.name}`;
  }

  @Memoize()
  public get description(): string {
    return `Delete a single "${this.resource}" node.`;
  }

  @Memoize()
  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      where: {
        type: GraphQLNonNull(this.resource.getInputType('WhereUnique').getGraphQLType()),
      },
    };
  }

  @Memoize()
  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return this.resource.getOutputType('Node').getGraphQLType();
  }

  public async resolve(params: OperationResolverParams<DeleteOneOperationArgs>): Promise<DeleteOneOperationResult> {
    const { args, context, operationContext, selectionNode } = params;
    const resource = this.resource;

    // Ensure the main "identifier" is requested
    selectionNode.setChildren(resource.getIdentifier().getSelectionNode(TypeKind.Input));

    const nodeSource = await resource.getQuery('FindOne').resolve(params);

    if (nodeSource) {
      const nodeId = resource.getInputType('WhereUnique').assert(nodeSource);

      await resource.emitSerial(ResourceHookKind.PreDelete, {
        metas: Object.freeze({
          args,
          context,
          operationContext,
          resource,
        }),
        toBeDeletedNodeId: nodeId,
      });

      // Actually delete the node
      const deletedNodeCount = await this.connector.delete({ ...params, resource, args: { where: nodeId } });

      if (deletedNodeCount === 1) {
        if (operationContext) {
          operationContext.postHooks.push(
            resource.emitSerial.bind(resource, ResourceHookKind.PostDelete, {
              metas: Object.freeze({
                args,
                context,
                operationContext,
                resource,
              }),
              deletedNodeId: nodeId,
            }),
          );
        }

        return nodeSource;
      }
    }

    return null;
  }
}
