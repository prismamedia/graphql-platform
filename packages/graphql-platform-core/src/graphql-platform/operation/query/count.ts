import { Maybe } from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLFieldConfigArgumentMap,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { OperationResolverParams } from '../../operation';
import { WhereInputValue } from '../../type/input';
import { AbstractOperation } from '../abstract-operation';

export interface CountOperationArgs {
  where?: Maybe<WhereInputValue>;
}

export type CountOperationResult = number;

export class CountOperation extends AbstractOperation<
  CountOperationArgs,
  CountOperationResult
> {
  @Memoize()
  public get name(): string {
    return `${this.resource.camelCasedName}Count`;
  }

  @Memoize()
  public get description(): string {
    return `Retrieve the number of "${this.resource}" nodes.`;
  }

  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return GraphQLNonNull(GraphQLInt);
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
    };
  }

  public async resolve(
    params: OperationResolverParams<CountOperationArgs>,
  ): Promise<CountOperationResult> {
    const { args, context } = params;
    const resource = this.resource;

    const filter = await resource.filter(context);

    return filter !== false
      ? this.connector.count(
          Object.freeze({
            resource,
            context,
            args: { ...args, where: { AND: [filter, args.where] } },
          }),
        )
      : 0;
  }
}
