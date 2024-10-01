import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import * as R from 'remeda';
import {
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import { UniqueReverseEdge } from '../../definition.js';
import type { NodeFilter, NodeSelectedValue } from '../../statement.js';
import {
  MultipleReverseEdgeUpdateInputAction,
  ReverseEdgeFilterInput,
  UniqueReverseEdgeUpdateInputAction,
  type NodeCreationInputValue,
  type NodeUniqueFilterInputValue,
} from '../../type.js';
import { AbstractMutation } from '../abstract-mutation.js';
import type { MutationContext } from './context.js';

export type ReplaceMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
  data: NonNullable<NodeCreationInputValue>;
}>;

export type ReplaceMutationResult = NodeSelectedValue;

export class ReplaceMutation<
  TRequestContext extends object,
> extends AbstractMutation<
  TRequestContext,
  ReplaceMutationArgs,
  ReplaceMutationResult
> {
  public readonly mutationTypes = [
    utils.MutationType.CREATION,
    utils.MutationType.UPDATE,
  ];

  protected readonly selectionAware = true;

  public readonly key = 'replace';
  public readonly name = `replace${this.node}`;
  public override readonly description = `Replaces an existing "${this.node}" or creates a new one`;

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
  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<ReplaceMutationArgs>,
    path: utils.Path,
  ): Promise<ReplaceMutationResult> {
    const replacement = await this.node.getMutationByKey('upsert').internal(
      context,
      authorization,
      {
        where: args.where,
        update: R.mapToObj(this.node.updateInputType.fields, (field) => [
          field.name,
          field instanceof ReverseEdgeFilterInput
            ? {
                [field.reverseEdge instanceof UniqueReverseEdge
                  ? UniqueReverseEdgeUpdateInputAction.DELETE_IF_EXISTS
                  : MultipleReverseEdgeUpdateInputAction.DELETE_ALL]: true,
                ...args.data[field.name],
              }
            : (args.data[field.name] ?? null),
        ]),
        create: args.data,
        selection: args.selection.mergeWith(this.node.selection),
      },
      path,
    );

    const errors: utils.GraphError[] = [];

    for (const leaf of this.node.leafSet) {
      const expectedLeafValue = args.data[leaf.name];
      const actualLeafValue = replacement[leaf.name];

      if (
        !leaf.isMutable() &&
        expectedLeafValue !== undefined &&
        expectedLeafValue !== actualLeafValue
      ) {
        errors.push(
          new utils.GraphError(
            `The immutable leaf "${leaf}" cannot be changed from "${actualLeafValue}" to "${expectedLeafValue}"`,
            { path: utils.addPath(path, leaf.name) },
          ),
        );
      }
    }

    if (errors.length) {
      throw errors.length > 1
        ? new utils.AggregateGraphError(errors, {
            message: `Some immutable leaves cannot be changed`,
            path,
          })
        : errors[0];
    }

    return args.selection.pickValue(replacement, path);
  }
}
