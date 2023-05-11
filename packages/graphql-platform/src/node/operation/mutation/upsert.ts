import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import type { NodeSelectedValue } from '../../statement/selection.js';
import type { NodeCreationInputValue } from '../../type/input/creation.js';
import type { NodeUniqueFilterInputValue } from '../../type/input/unique-filter.js';
import type { NodeUpdateInputValue } from '../../type/input/update.js';
import { AbstractMutation } from '../abstract-mutation.js';
import type { MutationContext } from './context.js';

export type UpsertMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
  create: NonNullable<NodeCreationInputValue>;
  update?: NodeUpdateInputValue;
}>;

export type UpsertMutationResult = NodeSelectedValue;

export class UpsertMutation<
  TRequestContext extends object,
> extends AbstractMutation<
  TRequestContext,
  UpsertMutationArgs,
  UpsertMutationResult
> {
  public override readonly mutationTypes = [
    utils.MutationType.CREATION,
    utils.MutationType.UPDATE,
  ] satisfies utils.MutationType[];

  protected override readonly selectionAware = true;
  public override readonly name = `upsert${this.node}`;
  public override readonly description = `Updates an existing "${this.node}" or creates a new one`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
      new utils.Input({
        name: 'create',
        type: utils.nonNillableInputType(this.node.creationInputType),
      }),
      new utils.Input({
        name: 'update',
        type: this.node.updateInputType,
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
    args: NodeSelectionAwareArgs<UpsertMutationArgs>,
    context: MutationContext,
    path: utils.Path,
  ): Promise<UpsertMutationResult> {
    return (
      (await this.node.getMutationByKey('update-one-if-exists').internal(
        authorization,
        {
          where: args.where,
          data: args.update,
          selection: args.selection,
        },
        context,
        path,
      )) ??
      (await this.node.getMutationByKey('create-one').internal(
        authorization,
        {
          data: args.create,
          selection: args.selection,
        },
        context,
        path,
      ))
    );
  }
}
