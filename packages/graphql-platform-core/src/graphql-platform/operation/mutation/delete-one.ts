import { GraphQLOperationType } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLFieldConfigArgumentMap,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { OperationResolverParams } from '../../operation';
import { NodeValue, ResourceHookKind } from '../../resource';
import { NodeSource, TypeKind, WhereUniqueInputValue } from '../../type';
import { AbstractOperation } from '../abstract-operation';

export interface DeleteOneOperationArgs {
  where: WhereUniqueInputValue;
}

export type DeleteOneOperationResult = NodeSource | null;

export class DeleteOneOperation extends AbstractOperation<
  DeleteOneOperationArgs,
  DeleteOneOperationResult
> {
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

  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return this.resource.getOutputType('Node').getGraphQLType();
  }

  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      where: {
        type: GraphQLNonNull(
          this.resource.getInputType('WhereUnique').getGraphQLType(),
        ),
      },
    };
  }

  public async resolve(
    params: OperationResolverParams<DeleteOneOperationArgs>,
  ): Promise<DeleteOneOperationResult> {
    const { args, context, selectionNode } = params;
    const resource = this.resource;

    // Select all the components in case of post success hooks
    selectionNode.setChildren(
      resource.getComponentSet().getSelectionNodeChildren(TypeKind.Input),
    );

    // Ensure the main "identifier" is requested
    selectionNode.setChildren(
      resource.getIdentifier().getSelectionNode(TypeKind.Input).getChildren(),
    );

    const node = await resource.getQuery('FindOne').resolve(params);

    if (node) {
      const nodeId = resource
        .getInputType('WhereUnique')
        .assertUnique(node, resource.getIdentifier(), true);

      await resource.emitSerial(ResourceHookKind.PreDelete, {
        metas: Object.freeze({
          args,
          context,
          resource,
        }),
        toBeDeletedNodeId: nodeId,
      });

      // Actually delete the node
      const deletedNodeCount = await this.connector.delete(
        Object.freeze({ resource, context, args: { where: nodeId } }),
      );

      if (deletedNodeCount === 1) {
        await resource.emitSerial(ResourceHookKind.ToBeDeleted, {
          metas: Object.freeze({
            ...params,
            resource,
          }),
          toBeDeletedNode: resource.serializeValue(
            node as NodeValue,
            true,
            resource.getComponentSet(),
          ),
        });

        if (context.operationContext.type === GraphQLOperationType.Mutation) {
          context.operationContext.postSuccessHooks?.push(
            resource.emit.bind(resource, ResourceHookKind.PostDelete, {
              metas: Object.freeze({
                args,
                context,
                resource,
              }),
              deletedNode: resource.serializeValue(
                node as NodeValue,
                true,
                resource.getComponentSet(),
              ),
            }),
          );
        }

        return node;
      }
    }

    return null;
  }
}
