import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLFieldConfigArgumentMap,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { OperationResolverParams } from '../../operation';
import { NodeSource, TypeKind, WhereUniqueInputValue } from '../../type';
import { AbstractOperation } from '../abstract-operation';
import { NodeNotFoundError } from '../error';
import { CreateOneDataInputValue } from './create-one';
import { UpdateOneDataInputValue } from './update-one';

export type UpsertOneOperationArgs = {
  where: WhereUniqueInputValue;
  create: CreateOneDataInputValue;
  update: UpdateOneDataInputValue;
};

export type UpsertOneOperationResult = NodeSource;

export class UpsertOneOperation extends AbstractOperation<
  UpsertOneOperationArgs,
  UpsertOneOperationResult
> {
  @Memoize()
  public isSupported(): boolean {
    return (
      super.isSupported() &&
      this.resource.getMutation('CreateOne').isSupported() &&
      this.resource.getMutation('UpdateOne').isSupported()
    );
  }

  @Memoize()
  public isPublic(): boolean {
    return (
      super.isPublic() &&
      this.resource.getMutation('CreateOne').isPublic() &&
      this.resource.getMutation('UpdateOne').isPublic()
    );
  }

  @Memoize()
  public get name(): string {
    return `upsert${this.resource.name}`;
  }

  @Memoize()
  public get description(): string {
    return `Update or create a single "${this.resource}" node.`;
  }

  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return GraphQLNonNull(this.resource.getOutputType('Node').getGraphQLType());
  }

  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    const { where, data: update } = this.resource
      .getMutation('UpdateOne')
      .getGraphQLFieldConfigArgs();
    const { data: create } = this.resource
      .getMutation('CreateOne')
      .getGraphQLFieldConfigArgs();

    return {
      where,
      update,
      create,
    };
  }

  public async resolve(
    params: OperationResolverParams<UpsertOneOperationArgs>,
  ): Promise<UpsertOneOperationResult> {
    const {
      args: { where, create, update },
    } = params;
    const resource = this.resource;

    // We select only the identifier
    const node = await resource.getQuery('FindOne').resolve({
      ...params,
      args: { where },
      selectionNode: resource.getIdentifier().getSelectionNode(TypeKind.Input),
    });

    if (node) {
      const nodeId = resource
        .getInputType('WhereUnique')
        .assertUnique(node, resource.getIdentifier(), true);

      const updatedNode = await resource.getMutation('UpdateOne').resolve({
        ...params,
        args: {
          where: nodeId,
          data: update,
        },
      });

      // Should never happen
      if (!updatedNode) {
        throw new NodeNotFoundError(resource.getMutation('UpdateOne'), nodeId);
      }

      return updatedNode;
    } else {
      return resource.getMutation('CreateOne').resolve({
        ...params,
        args: { data: create },
      });
    }
  }
}
