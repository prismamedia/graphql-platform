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
import type { NodeUniqueFilterInputValue } from '../../../type/input/unique-filter.js';
import { AbstractCreation } from '../abstract-creation.js';
import type { MutationContext } from './../context.js';

export type CreateOneIfNotExistsMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
  data: NonNullable<NodeCreationInputValue>;
}>;

export type CreateOneIfNotExistsMutationResult = NodeSelectedValue;

/**
 * This mutation is the same as an upsert without update but it does not require the "update" authorization nor the "mutability"
 */
export class CreateOneIfNotExistsMutation<
  TRequestContext extends object,
> extends AbstractCreation<
  TRequestContext,
  CreateOneIfNotExistsMutationArgs,
  CreateOneIfNotExistsMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `create${this.node}IfNotExists`;
  public override readonly description = `Creates one "${this.node}" if it does not exist, returns the existing otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
      new utils.Input({
        name: 'data',
        type: utils.nonNillableInputType(this.node.creationInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<CreateOneIfNotExistsMutationArgs>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<CreateOneIfNotExistsMutationResult> {
    return (
      (await this.node
        .getQueryByKey('get-one-if-exists')
        .internal(
          authorization,
          { where: args.where, selection: args.selection },
          context,
          path,
        )) ??
      (await this.node
        .getMutationByKey('create-one')
        .internal(
          authorization,
          { data: args.data, selection: args.selection },
          context,
          path,
        ))
    );
  }
}
