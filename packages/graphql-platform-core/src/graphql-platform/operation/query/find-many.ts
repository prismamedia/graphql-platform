import { Maybe } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLFieldConfigArgumentMap,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { OperationResolverParams } from '../../operation';
import { NodeSource, OrderByInputValue, WhereInputValue } from '../../type';
import { AbstractOperation } from '../abstract-operation';

export interface FindManyOperationArgs {
  where?: Maybe<WhereInputValue>;
  orderBy?: Maybe<OrderByInputValue>;
  first: number;
  skip?: Maybe<number>;
}

export type FindManyOperationResult = NodeSource[];

export class FindManyOperation extends AbstractOperation<
  FindManyOperationArgs,
  FindManyOperationResult
> {
  @Memoize()
  public get name(): string {
    return this.resource.camelCasedPlural;
  }

  @Memoize()
  public get description(): string {
    return `Retrieve a list of "${this.resource}" nodes.`;
  }

  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return GraphQLNonNull(
      GraphQLList(
        GraphQLNonNull(this.resource.getOutputType('Node').getGraphQLType()),
      ),
    );
  }

  public getGraphQLFieldConfigArgs(): GraphQLFieldConfigArgumentMap {
    return {
      ...(this.resource.getInputType('Where').isSupported()
        ? {
            where: {
              type: this.resource.getInputType('Where').getGraphQLType(),
            },
          }
        : undefined),
      ...(this.resource.getInputType('OrderBy').isSupported()
        ? {
            orderBy: {
              type: GraphQLList(
                GraphQLNonNull(
                  this.resource.getInputType('OrderBy').getGraphQLType(),
                ),
              ),
            },
          }
        : undefined),
      first: {
        type: GraphQLNonNull(GraphQLInt),
      },
      skip: {
        type: GraphQLInt,
      },
    };
  }

  public async resolve(
    params: OperationResolverParams<FindManyOperationArgs>,
  ): Promise<FindManyOperationResult> {
    const { args, context, selectionNode } = params;
    const resource = this.resource;

    const filter = await resource.filter(context);

    return filter !== false
      ? this.connector.find(
          Object.freeze({
            resource,
            context,
            args: {
              ...args,
              where: { AND: [filter, args.where] },
              selectionNode,
            },
          }),
        )
      : [];
  }
}
