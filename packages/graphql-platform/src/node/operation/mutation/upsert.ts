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
  public readonly mutationTypes = [
    utils.MutationType.CREATION,
    utils.MutationType.UPDATE,
  ];

  protected readonly selectionAware = true;

  public readonly key = 'upsert';
  public readonly name = `upsert${this.node}`;
  public readonly description = `Updates an existing "${this.node}" or creates a new one`;

  @Memoize()
  public get arguments() {
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
  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<UpsertMutationArgs>,
    path: utils.Path,
  ): Promise<UpsertMutationResult> {
    return (
      (await this.node.getMutationByKey('update-one-if-exists').internal(
        context,
        authorization,
        {
          where: args.where,
          data: args.update,
          selection: args.selection,
        },
        utils.addPath(path, 'update'),
      )) ??
      (await this.node.getMutationByKey('create-one').internal(
        context,
        authorization,
        {
          data: args.create,
          selection: args.selection,
        },
        utils.addPath(path, 'create'),
      ))
    );
  }
}
