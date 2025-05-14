import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter, MMethod } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { NodeDeletion } from '../../../change.js';
import { OnEdgeHeadDeletion } from '../../../definition.js';
import { NodeFilter, type NodeSelectedValue } from '../../../statement.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../../type.js';
import { OperationError, catchConnectorOperationError } from '../../error.js';
import { AbstractDeletion } from '../abstract-deletion.js';
import type { MutationContext } from '../context.js';

export type DeleteManyMutationArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  first: number;
}>;

export type DeleteManyMutationResult = NodeSelectedValue[];

export class DeleteManyMutation<
  TRequestContext extends object,
> extends AbstractDeletion<
  DeleteManyMutationArgs,
  DeleteManyMutationResult,
  TRequestContext,
  ConnectorInterface
> {
  protected readonly selectionAware = true;

  public readonly key = 'delete-many';
  public readonly name = `delete${this.node.plural}`;
  public override readonly description = `Deletes many "${this.node.plural}"`;

  @MGetter
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
      new utils.Input({
        name: 'orderBy',
        type: new utils.ListableInputType(
          utils.nonNillableInputType(this.node.orderingInputType),
        ),
      }),
      new utils.Input({
        name: 'first',
        type: utils.nonNillableInputType(scalars.typesByName.UnsignedInt),
      }),
    ];
  }

  @MMethod()
  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(
        new graphql.GraphQLNonNull(this.node.outputType.getGraphQLObjectType()),
      ),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<DeleteManyMutationArgs>,
    path: utils.Path,
  ): Promise<DeleteManyMutationResult> {
    if (!args.first) {
      return [];
    }

    const argsPath = utils.addPath(path, argsPathKey);

    const where = this.node.filterInputType.filter(
      args.where,
      context,
      utils.addPath(argsPath, 'where'),
    ).normalized;

    const filter = (
      authorization && where ? authorization.and(where) : authorization || where
    )?.normalized;

    if (filter?.isFalse()) {
      return [];
    }

    const ordering = this.node.orderingInputType.sort(
      args.orderBy,
      context,
      utils.addPath(argsPath, 'orderBy'),
    ).normalized;

    const internalSelection = this.node.selection.mergeWith(args.selection);

    // Fetch the current nodes' value
    const rawOldSources = await catchConnectorOperationError(
      () =>
        this.connector.find(
          context,
          {
            node: this.node,
            ...(filter && { filter }),
            ...(ordering && { ordering }),
            limit: args.first,
            selection: internalSelection,
            forMutation: utils.MutationType.DELETION,
          },
          path,
        ),
      context.request,
      this.node,
      { path },
    );

    if (!rawOldSources.length) {
      return [];
    }

    const oldValues = await Promise.all(
      rawOldSources.map((rawOldSource) =>
        internalSelection.resolveValue(
          internalSelection.parseSource(rawOldSource, path),
          context,
          path,
        ),
      ),
    );

    const ids = oldValues.map((oldValue) =>
      this.node.mainIdentifier.selection.pickValue(oldValue),
    );

    // Apply the "preDelete"-hooks, if any
    if (this.node.hasPreDeleteHooks) {
      for (const [index, oldValue] of oldValues.entries()) {
        await this.node.preDelete(
          {
            context,
            id: ids[index],
            current: this.node.selection.pickValue(oldValue),
          },
          path,
        );
      }
    }

    // Apply the related nodes' "OnHeadDeletion" action
    {
      const cascadeReverseEdgesByHead =
        this.node.getReverseEdgesByHeadByActionOnOriginalEdgeDeletion(
          OnEdgeHeadDeletion.CASCADE,
        );

      for (const [head, reverseEdges] of cascadeReverseEdgesByHead) {
        try {
          await head.getMutationByKey('delete-many').execute(
            context,
            {
              where: {
                OR: reverseEdges.map(({ originalEdge }) => ({
                  [originalEdge.name]: {
                    OR: oldValues.map((oldValue) =>
                      originalEdge.referencedUniqueConstraint.parseValue(
                        oldValue,
                      ),
                    ),
                  },
                })),
              },
              first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
              selection: head.mainIdentifier.selection,
            },
            path,
          );
        } catch (cause) {
          throw new OperationError(context.request, this.node, {
            mutationType: utils.MutationType.DELETION,
            cause,
            path,
            reason: `deleting linked "${head.plural}"`,
          });
        }
      }

      const setNullReverseEdges =
        this.node.getReverseEdgesByActionOnOriginalEdgeDeletion(
          OnEdgeHeadDeletion.SET_NULL,
        );

      for (const { head, originalEdge } of setNullReverseEdges) {
        try {
          await head.getMutationByKey('update-many').execute(
            context,
            {
              where: {
                [originalEdge.name]: {
                  OR: oldValues.map((oldValue) =>
                    originalEdge.referencedUniqueConstraint.parseValue(
                      oldValue,
                    ),
                  ),
                },
              },
              first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
              data: { [originalEdge.name]: null },
              selection: head.mainIdentifier.selection,
            },
            path,
          );
        } catch (cause) {
          throw new OperationError(context.request, this.node, {
            mutationType: utils.MutationType.DELETION,
            cause,
            path,
            reason: `unlinking "${head.plural}"`,
          });
        }
      }
    }

    // Actually delete the nodes
    await catchConnectorOperationError(
      () =>
        this.connector.delete(
          context,
          {
            node: this.node,
            filter: this.node.filterInputType.filter({ OR: ids }),
          },
          path,
        ),
      context.request,
      this.node,
      {
        mutatedValue:
          oldValues.length === 1
            ? this.node.selection.pickValue(oldValues[0], path)
            : undefined,
        mutationType: utils.MutationType.DELETION,
        path,
      },
    );

    for (const oldValue of oldValues) {
      const change = new NodeDeletion(this.node, context.request, oldValue);

      // Let's everybody know about this deleted node
      context.changes.add(change);

      // Apply the "postDelete"-hooks, if any
      await this.node.postDelete({ context, change }, path);
    }

    return oldValues.map((oldValue) => args.selection.pickValue(oldValue));
  }
}
