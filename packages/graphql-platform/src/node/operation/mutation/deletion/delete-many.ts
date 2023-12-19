import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { NodeDeletion } from '../../../change.js';
import { OnEdgeHeadDeletion } from '../../../definition.js';
import {
  AndOperation,
  NodeFilter,
  type NodeSelectedValue,
} from '../../../statement.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../../type.js';
import {
  catchConnectorOperationError,
  ConnectorOperationKind,
  LifecycleHookError,
  LifecycleHookKind,
} from '../../error.js';
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
  TRequestContext,
  DeleteManyMutationArgs,
  DeleteManyMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'delete-many';
  public readonly name = `delete${this.node.plural}`;
  public readonly description = `Deletes many "${this.node.plural}"`;

  @Memoize()
  public get arguments() {
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

  @Memoize()
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

    const filter = new NodeFilter(
      this.node,
      AndOperation.create([
        authorization?.filter,
        this.node.filterInputType.filter(
          args.where,
          context,
          utils.addPath(argsPath, 'where'),
        ).filter,
      ]),
    ).normalized;

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
        this.connector.find(context, {
          node: this.node,
          ...(filter && { filter }),
          ...(ordering && { ordering }),
          limit: args.first,
          selection: internalSelection,
          forMutation: utils.MutationType.DELETION,
        }),
      this.node,
      ConnectorOperationKind.FIND,
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

    // Apply the "preDelete"-hook, if any
    if (this.node.preDeletionHooks.length) {
      await Promise.all(
        oldValues.map(async (oldValue, index) => {
          try {
            await this.node.preDelete({
              context,
              id: Object.freeze(ids[index]),
              current: Object.freeze(this.node.selection.pickValue(oldValue)),
            });
          } catch (cause) {
            throw new LifecycleHookError(
              this.node,
              LifecycleHookKind.PRE_DELETE,
              { cause, path },
            );
          }
        }),
      );
    }

    // Apply the related nodes' "OnHeadDeletion" action
    {
      const cascadeReverseEdgesByHead = this.node.getReverseEdgesByHeadByAction(
        OnEdgeHeadDeletion.CASCADE,
      );
      const setNullReverseEdges = this.node.getReverseEdgesByAction(
        OnEdgeHeadDeletion.SET_NULL,
      );

      if (cascadeReverseEdgesByHead.size || setNullReverseEdges.length) {
        await Promise.all([
          // CASCADE
          ...Array.from(cascadeReverseEdgesByHead, ([head, reverseEdges]) =>
            head.getMutationByKey('delete-many').execute(context, {
              where: {
                OR: reverseEdges.map((reverseEdge) => ({
                  [reverseEdge.originalEdge.name]: {
                    OR: oldValues.map((oldValue) =>
                      reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
                        oldValue,
                      ),
                    ),
                  },
                })),
              },
              first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
              selection: head.mainIdentifier.selection,
            }),
          ),

          // SET_NULL
          ...setNullReverseEdges.map((reverseEdge) =>
            reverseEdge.head.getMutationByKey('update-many').execute(context, {
              where: {
                [reverseEdge.originalEdge.name]: {
                  OR: oldValues.map((oldValue) =>
                    reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
                      oldValue,
                    ),
                  ),
                },
              },
              first: scalars.GRAPHQL_MAX_UNSIGNED_INT,
              data: { [reverseEdge.originalEdge.name]: null },
              selection: reverseEdge.head.mainIdentifier.selection,
            }),
          ),
        ]);
      }
    }

    // Actually delete the nodes
    await catchConnectorOperationError(
      () =>
        this.connector.delete(context, {
          node: this.node,
          filter: this.node.filterInputType.filter({ OR: ids }),
        }),
      this.node,
      ConnectorOperationKind.DELETE,
      { path },
    );

    return Promise.all(
      oldValues.map(async (oldValue) => {
        const change = new NodeDeletion(this.node, context.request, oldValue);

        // Let's everybody know about this deleted node
        context.changes.push(change);

        // Apply the "postDelete"-hook, if any
        try {
          await this.node.postDelete({ context, change });
        } catch (cause) {
          throw new LifecycleHookError(
            this.node,
            LifecycleHookKind.POST_DELETE,
            { cause, path },
          );
        }

        return args.selection.pickValue(oldValue);
      }),
    );
  }
}
