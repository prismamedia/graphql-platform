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
import { OnEdgeHeadDeletion } from '../../../definition/component/edge.js';
import { AndOperation, NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../../type.js';
import {
  catchConnectorOperationError,
  ConnectorOperationKind,
  LifecycleHookError,
  LifecycleHookKind,
} from '../../error.js';
import { AbstractDeletion, type DeletionConfig } from '../abstract-deletion.js';
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
  readonly #config?: DeletionConfig<any, any, any, any> =
    this.node.getMutationConfig(utils.MutationType.DELETION).config;

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
    const preDelete = this.#config?.preDelete;
    const postDelete = this.#config?.postDelete;

    if (args.first === 0) {
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

    // Fetch the current nodes' value
    const currentValues = await catchConnectorOperationError(
      () =>
        this.connector.find(context, {
          node: this.node,
          ...(filter && { filter }),
          ...(ordering && { ordering }),
          limit: args.first,
          selection: this.node.selection.mergeWith(args.selection),
          forMutation: utils.MutationType.DELETION,
        }),
      this.node,
      ConnectorOperationKind.FIND,
      { path },
    );

    if (currentValues.length === 0) {
      return [];
    }

    const currentIds = currentValues.map((currentValue) =>
      Object.freeze(this.node.mainIdentifier.parseValue(currentValue)),
    );

    // Apply the "preDelete"-hook, if any
    if (preDelete) {
      await Promise.all(
        currentValues.map(async (currentValue, index) => {
          try {
            await preDelete({
              gp: this.gp,
              node: this.node,
              context,
              api: context.api,
              id: currentIds[index],
              current: Object.freeze(this.node.parseValue(currentValue)),
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
                    OR: currentValues.map((currentValue) =>
                      reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
                        currentValue,
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
                  OR: currentValues.map((currentValue) =>
                    reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
                      currentValue,
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
          filter: this.node.filterInputType.filter({
            OR: currentIds,
          }),
        }),
      this.node,
      ConnectorOperationKind.DELETE,
      { path },
    );

    return Promise.all(
      currentValues.map(async (oldValue) => {
        const change = new NodeDeletion(this.node, context.request, oldValue);

        // Let's everybody know about this deleted node
        context.appendChange(change);

        // Apply the "postDelete"-hook, if any
        try {
          await postDelete?.({
            gp: this.gp,
            node: this.node,
            context,
            api: context.api,
            change,
          });
        } catch (cause) {
          throw new LifecycleHookError(
            this.node,
            LifecycleHookKind.POST_DELETE,
            { cause, path },
          );
        }

        return args.selection.parseValue(oldValue);
      }),
    );
  }
}
