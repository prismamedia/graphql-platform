import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { OperationResolverParams } from '../../operation';
import { CreateInputValue, NodeSource, TypeKind, UpdateInputValue, WhereUniqueInputValue } from '../../type';
import { AbstractOperation } from '../abstract-operation';

export interface UpsertOneOperationArgs {
  where: WhereUniqueInputValue;
  create: CreateInputValue;
  update: UpdateInputValue;
}

export type UpsertOneOperationResult = NodeSource;

export class UpsertOneOperation extends AbstractOperation<UpsertOneOperationArgs, UpsertOneOperationResult> {
  @Memoize()
  public isSupported(): boolean {
    return this.resource.getMutation('CreateOne').isSupported() && this.resource.getMutation('UpdateOne').isSupported();
  }

  @Memoize()
  public get name(): string {
    return `upsert${this.resource.name}`;
  }

  @Memoize()
  public get description(): string {
    return `Update or create a single "${this.resource}" node.`;
  }

  @Memoize()
  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      where: {
        type: GraphQLNonNull(this.resource.getInputType('WhereUnique').getGraphQLType()),
      },
      create: {
        type: GraphQLNonNull(this.resource.getInputType('Create').getGraphQLType()),
      },
      update: {
        type: GraphQLNonNull(this.resource.getInputType('Update').getGraphQLType()),
      },
    };
  }

  @Memoize()
  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return GraphQLNonNull(this.resource.getOutputType('Node').getGraphQLType());
  }

  public async resolve(params: OperationResolverParams<UpsertOneOperationArgs>): Promise<UpsertOneOperationResult> {
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

    const result = await (!node
      ? resource.getMutation('CreateOne').resolve({
          ...params,
          args: { data: create },
        })
      : resource.getMutation('UpdateOne').resolve({
          ...params,
          args: {
            where: resource.parseId(node, true),
            data: update,
          },
        }));

    if (!result) {
      throw new Error(`An error occured during the upserting of "${this}", it has to return a result.`);
    }

    return result;
  }
}
