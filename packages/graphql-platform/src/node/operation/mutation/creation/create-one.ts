import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import type { NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection/value.js';
import type { NodeCreationInputValue } from '../../../type/input/creation.js';
import { AbstractCreation } from '../abstract-creation.js';
import type { MutationContext } from './../context.js';

export type CreateOneMutationArgs = RawNodeSelectionAwareArgs<{
  data: NonNullable<NodeCreationInputValue>;
}>;

export type CreateOneMutationResult = NodeSelectedValue;

export class CreateOneMutation<
  TRequestContext extends object,
> extends AbstractCreation<
  TRequestContext,
  CreateOneMutationArgs,
  CreateOneMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'create-one';
  public readonly name = `create${this.node}`;
  public readonly description = `Creates one "${this.node}", throws an error if it already exists`;

  @Memoize()
  public get arguments() {
    return [
      new utils.Input({
        name: 'data',
        type: utils.nonNillableInputType(this.node.creationInputType),
      }),
    ];
  }

  @Memoize()
  public getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<CreateOneMutationArgs>,
    path: utils.Path,
  ): Promise<CreateOneMutationResult> {
    const [nodeValue] = await this.node
      .getMutationByKey('create-some')
      .internal(
        context,
        authorization,
        { data: [args.data], selection: args.selection },
        path,
      );

    return nodeValue;
  }
}
