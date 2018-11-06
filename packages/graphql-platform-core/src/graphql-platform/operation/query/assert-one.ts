import { GraphQLFieldConfigArgumentMap, GraphQLNonNull, GraphQLOutputType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { OperationResolverParams } from '../../operation';
import { AbstractOperation } from '../abstract-operation';
import { FindOneOperationArgs, FindOneOperationResult } from './find-one';

export interface AssertOneOperationArgs extends FindOneOperationArgs {}

export type AssertOneOperationResult = NonNullable<FindOneOperationResult>;

export class AssertOneOperation extends AbstractOperation<AssertOneOperationArgs, AssertOneOperationResult> {
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
    return GraphQLNonNull(this.resource.getOutputType('Node').getGraphQLType());
  }

  public async resolve(params: OperationResolverParams<AssertOneOperationArgs>): Promise<AssertOneOperationResult> {
    const resource = this.resource;

    const node = await resource.getQuery('FindOne').resolve(params);

    if (!node) {
      throw new Error(
        `The "${resource.name}" node identified by "${JSON.stringify(params.args.where)}" does not exist.`,
      );
    }

    return node;
  }
}
