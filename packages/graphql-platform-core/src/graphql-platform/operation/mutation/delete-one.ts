import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { OperationResolverParams } from '../../operation';
import { NodeValue, ResourceHookKind } from '../../resource';
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
    const { operationContext, selectionNode } = params;
    const resource = this.resource;

    // Select all the components in case of post hooks
    if (resource.getEventListenerCount(ResourceHookKind.PostCreate) > 0) {
      selectionNode.setChildren(resource.getComponentSet().getSelectionNodeChildren(TypeKind.Input));
    }

    // Ensure the main "identifier" is requested
    selectionNode.setChildren(
      resource
        .getIdentifier()
        .getSelectionNode(TypeKind.Input)
        .getChildren(),
    );

    const nodeSource = await resource.getQuery('FindOne').resolve(params);

    if (nodeSource) {
      const nodeId = resource.getInputType('WhereUnique').assert(nodeSource);

      await resource.emitSerial(ResourceHookKind.PreDelete, {
        metas: Object.freeze({
          ...params,
          resource,
        }),
        toBeDeletedNodeId: nodeId,
      });

      // Actually delete the node
      const deletedNodeCount = await this.connector.delete(
        Object.freeze({ ...params, resource, args: { where: nodeId } }),
      );

      if (deletedNodeCount === 1) {
        operationContext.postSuccessHooks.push(
          resource.emitSerial.bind(resource, ResourceHookKind.PostDelete, {
            metas: Object.freeze({
              ...params,
              resource,
            }),
            deletedNode: nodeSource as NodeValue,
          }),
        );

        return nodeSource;
      }
    }

    return null;
  }
}
