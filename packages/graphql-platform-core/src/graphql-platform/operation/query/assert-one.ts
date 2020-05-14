import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLFieldConfigArgumentMap,
  GraphQLNonNull,
  GraphQLOutputType,
} from 'graphql';
import { OperationResolverParams } from '../../operation';
import { AbstractOperation } from '../abstract-operation';
import { NodeNotFoundError } from '../error';
import { FindOneOperationArgs, FindOneOperationResult } from './find-one';

export interface AssertOneOperationArgs extends FindOneOperationArgs {}

export type AssertOneOperationResult = NonNullable<FindOneOperationResult>;

export class AssertOneOperation extends AbstractOperation<
  AssertOneOperationArgs,
  AssertOneOperationResult
> {
  public isPublic() {
    return false;
  }

  @Memoize()
  public get name(): string {
    return `assert${this.resource.name}`;
  }

  @Memoize()
  public get description(): string {
    return `Retrieve a single "${this.resource}" node, fail otherwise.`;
  }

  public getGraphQLFieldConfigType(): GraphQLOutputType {
    return GraphQLNonNull(this.resource.getOutputType('Node').getGraphQLType());
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
    params: OperationResolverParams<AssertOneOperationArgs>,
  ): Promise<AssertOneOperationResult> {
    const node = await this.resource.getQuery('FindOne').resolve(params);
    if (!node) {
      throw new NodeNotFoundError(this, params.args.where);
    }

    return node;
  }
}
