import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
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
import { createContextBoundAPI } from '../../api.js';
import {
  ConnectorError,
  NodeLifecycleHookError,
  NodeLifecycleHookKind,
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
  TConnector extends ConnectorInterface,
> extends AbstractDeletion<
  TRequestContext,
  TConnector,
  DeleteManyMutationArgs,
  DeleteManyMutationResult
> {
  readonly #config?: DeletionConfig<TRequestContext, TConnector> =
    this.node.getMutationConfig(utils.MutationType.DELETION).config;
  readonly #configPath: utils.Path = this.node.getMutationConfig(
    utils.MutationType.DELETION,
  ).configPath;

  protected override readonly selectionAware = true;
  public override readonly name = `delete${this.node.plural}`;
  public override readonly description = `Deletes many "${this.node.plural}"`;

  @Memoize()
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

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(
        new graphql.GraphQLNonNull(this.node.outputType.getGraphQLObjectType()),
      ),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: NodeSelectionAwareArgs<DeleteManyMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
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
      new AndOperation([
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
    let currentValues: NodeSelectedValue[];
    try {
      currentValues = await this.connector.find(
        {
          node: this.node,
          ...(filter && { filter }),
          ...(ordering && { ordering }),
          limit: args.first,
          selection: this.node.selection.mergeWith(args.selection),
          forMutation: utils.MutationType.DELETION,
        },
        context,
      );
    } catch (error) {
      throw new ConnectorError({ cause: error, path });
    }

    if (currentValues.length === 0) {
      return [];
    }

    // Apply the "preDelete"-hook, if any
    if (preDelete) {
      await Promise.all(
        currentValues.map(async (currentValue) => {
          try {
            await preDelete({
              gp: this.gp,
              node: this.node,
              context,
              api: createContextBoundAPI(this.gp, context),
              currentValue: Object.freeze(this.node.parseValue(currentValue)),
            });
          } catch (error) {
            throw new NodeLifecycleHookError(
              this.node,
              NodeLifecycleHookKind.PRE_DELETE,
              { cause: error, path },
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
            head.getMutationByKey('delete-many').execute(
              {
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
                selection: head.identifier.selection,
              },
              context,
            ),
          ),

          // SET_NULL
          ...setNullReverseEdges.map((reverseEdge) =>
            reverseEdge.head.getMutationByKey('update-many').execute(
              {
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
                selection: reverseEdge.head.identifier.selection,
              },
              context,
            ),
          ),
        ]);
      }
    }

    // Actually delete the nodes
    try {
      await this.connector.delete(
        {
          node: this.node,
          filter: this.node.filterInputType.parseAndFilter({
            OR: currentValues.map((currentValue) =>
              this.node.identifier.parseValue(currentValue),
            ),
          }),
        },
        context,
      );
    } catch (error) {
      throw new ConnectorError({ cause: error, path });
    }

    return Promise.all(
      currentValues.map(async (oldValue) => {
        const change = new NodeDeletion(
          this.node,
          context.requestContext,
          oldValue,
        );

        // Let's everybody know about this deleted node
        context.changes.push(change);

        // Apply the "postDelete"-hook, if any
        try {
          await postDelete?.({
            gp: this.gp,
            node: this.node,
            context,
            api: createContextBoundAPI(this.gp, context),
            change,
          });
        } catch (error) {
          throw new NodeLifecycleHookError(
            this.node,
            NodeLifecycleHookKind.POST_DELETE,
            { cause: error, path },
          );
        }

        return args.selection.parseValue(oldValue);
      }),
    );
  }
}
