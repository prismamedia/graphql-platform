import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { DeletedNode } from '../../../change.js';
import { OnEdgeHeadDeletion } from '../../../definition/component/edge.js';
import { AndOperation, NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../../type.js';
import { createContextBoundAPI } from '../../api.js';
import {
  catchConnectorError,
  catchLifecycleHookError,
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
    const currentValues = await catchConnectorError(
      () =>
        this.connector.find(
          {
            node: this.node,
            ...(filter && { filter }),
            ...(ordering && { ordering }),
            limit: args.first,
            selection: this.node.selection.mergeWith(args.selection),
            forMutation: utils.MutationType.DELETION,
          },
          context,
        ),
      path,
    );

    if (currentValues.length === 0) {
      return [];
    }

    // Apply the "preDelete"-hook, if any
    if (this.#config?.preDelete) {
      await Promise.all(
        currentValues.map(async (currentValue) =>
          catchLifecycleHookError(
            () =>
              this.#config!.preDelete!({
                gp: this.gp,
                node: this.node,
                context,
                api: createContextBoundAPI(this.gp, context),
                currentValue: Object.freeze(this.node.parseValue(currentValue)),
              }),
            this.node,
            LifecycleHookKind.PRE_DELETE,
            path,
          ),
        ),
      );
    }

    // Apply the related nodes' "OnHeadDeletion"
    if (this.node.reverseEdgesByName.size) {
      await Promise.all(
        Array.from(this.node.reverseEdgesByName.values()).map((reverseEdge) => {
          switch (reverseEdge.originalEdge.onHeadDeletion) {
            case OnEdgeHeadDeletion.RESTRICT:
              // Nothing to do, the database will take care of it
              break;

            case OnEdgeHeadDeletion.SET_NULL:
              return reverseEdge.head.getMutationByKey('update-many').execute(
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
                  first: 1_000_000,
                  data: { [reverseEdge.originalEdge.name]: null },
                  selection: reverseEdge.head.identifier.selection,
                },
                context,
              );

            case OnEdgeHeadDeletion.CASCADE:
              return reverseEdge.head.getMutationByKey('delete-many').execute(
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
                  first: 1_000_000,
                  selection: reverseEdge.head.identifier.selection,
                },
                context,
              );
          }
        }),
      );
    }

    // Actually delete the nodes
    await catchConnectorError(
      () =>
        this.connector.delete(
          {
            node: this.node,
            filter: this.node.filterInputType.parseAndFilter({
              OR: currentValues.map((currentValue) =>
                this.node.identifier.parseValue(currentValue),
              ),
            }),
          },
          context,
        ),
      path,
    );

    return Promise.all(
      currentValues.map(async (oldValue) => {
        const change = new DeletedNode(
          this.node,
          context.requestContext,
          oldValue,
        );

        // Let's everybody know about this deleted node
        context.trackChange(change);

        // Apply the "postDelete"-hook, if any
        if (this.#config?.postDelete) {
          await catchLifecycleHookError(
            () =>
              this.#config!.postDelete!({
                gp: this.gp,
                node: this.node,
                context,
                api: createContextBoundAPI(this.gp, context),
                change,
              }),
            this.node,
            LifecycleHookKind.POST_DELETE,
            path,
          );
        }

        return args.selection.parseValue(oldValue);
      }),
    );
  }
}
