import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { OperationResolverParams } from '../../operation';
import { NodeSource } from '../../type';
import { WhereUniqueInputValue } from '../../type/input';
import { AbstractOperation } from '../abstract-operation';

export interface FindOneOperationArgs {
  where: WhereUniqueInputValue;
}

export type FindOneOperationResult = NodeSource | null;

export class FindOneOperation extends AbstractOperation<FindOneOperationArgs, FindOneOperationResult> {
  @Memoize()
  public get name(): string {
    return this.resource.camelCasedName;
  }

  @Memoize()
  public get description(): string {
    return `Retrieve a single "${this.resource}" node.`;
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

  public async resolve(params: OperationResolverParams<FindOneOperationArgs>): Promise<FindOneOperationResult> {
    const {
      args: { where },
    } = params;

    const nodes = await this.resource.getQuery('FindMany').resolve({
      ...params,
      args: {
        where: this.resource.parseId(where, true),
        first: 1,
      },
    });

    return nodes.length === 1 ? nodes[0] : null;
  }
}
