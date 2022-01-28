import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  aggregateConcurrentError,
  Input,
  ListableInputType,
  MutationType,
  nonNillableInputType,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { DeletedNode } from '../../../change.js';
import { OnHeadDeletion } from '../../../definition/component/edge.js';
import { AndOperation, NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../../type.js';
import { createContextBoundAPI } from '../../api.js';
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
    this.node.getMutationConfig(MutationType.DELETION).config;
  readonly #configPath: Path = this.node.getMutationConfig(
    MutationType.DELETION,
  ).configPath;

  protected override readonly selectionAware = true;
  public override readonly name = `delete${this.node.plural}`;
  public override readonly description = `Deletes many "${this.node.plural}"`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
      new Input({
        name: 'orderBy',
        type: new ListableInputType(
          nonNillableInputType(this.node.orderingInputType),
        ),
      }),
      new Input({
        name: 'first',
        type: nonNillableInputType(Scalars.UnsignedInt),
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
    args: NodeSelectionAwareArgs<DeleteManyMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<DeleteManyMutationResult> {
    if (args.first === 0) {
      return [];
    }

    const argsPath = addPath(path, argsPathKey);

    const filter = new NodeFilter(
      this.node,
      new AndOperation([
        this.node.getAuthorization(
          context.requestContext,
          path,
          MutationType.DELETION,
        )?.filter,
        this.node.filterInputType.filter(
          args.where,
          context,
          addPath(argsPath, 'where'),
        ).filter,
      ]),
    ).normalized;

    if (filter?.isFalse()) {
      return [];
    }

    const ordering = this.node.orderingInputType.sort(
      args.orderBy,
      context,
      addPath(argsPath, 'orderBy'),
    ).normalized;

    // Fetch the current nodes' value
    const currentValues = await this.connector.find(
      {
        node: this.node,
        ...(filter && { where: filter }),
        ...(ordering && { orderBy: ordering }),
        limit: args.first,
        selection: args.selection.mergeWith(this.node.selection),
        forMutation: MutationType.DELETION,
      },
      context,
    );

    if (currentValues.length === 0) {
      return [];
    }

    // Apply the "preDelete"-hook
    if (this.#config?.preDelete) {
      await aggregateConcurrentError<NodeSelectedValue, void>(
        currentValues,
        async (currentValue) =>
          this.#config!.preDelete!({
            gp: this.gp,
            node: this.node,
            context,
            api: createContextBoundAPI(this.gp, context),
            currentValue: Object.freeze(this.node.parseValue(currentValue)),
          }),
        { path },
      );
    }

    // Apply the related nodes' "OnHeadDeletion"
    if (this.node.reverseEdgesByName.size) {
      await Promise.all(
        Array.from(this.node.reverseEdgesByName.values()).map((reverseEdge) => {
          switch (reverseEdge.originalEdge.onHeadDeletion) {
            case OnHeadDeletion.RESTRICT:
              // Nothing to do, the database will take care of it
              break;

            case OnHeadDeletion.SET_NULL:
              return reverseEdge.head.getMutation('update-many').execute(
                {
                  where: {
                    [reverseEdge.originalEdge.name]: {
                      OR: currentValues
                        .map((currentValue) =>
                          reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
                            currentValue,
                          ),
                        )
                        .filter(Boolean),
                    },
                  },
                  first: 1_000_000,
                  data: { [reverseEdge.originalEdge.name]: null },
                  selection: reverseEdge.head.identifier.selection,
                },
                context,
              );

            case OnHeadDeletion.CASCADE:
              return reverseEdge.head.getMutation('delete-many').execute(
                {
                  where: {
                    [reverseEdge.originalEdge.name]: {
                      OR: currentValues
                        .map((currentValue) =>
                          reverseEdge.originalEdge.referencedUniqueConstraint.parseValue(
                            currentValue,
                          ),
                        )
                        .filter(Boolean),
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
    await this.connector.delete(
      {
        node: this.node,
        where: this.node.filterInputType.parseAndFilter({
          OR: currentValues.map((currentValue) =>
            this.node.identifier.parseValue(currentValue),
          ),
        }),
        limit: currentValues.length,
      },
      context,
    );

    const deletedAt = new Date();

    return aggregateConcurrentError<NodeSelectedValue, NodeSelectedValue>(
      currentValues,
      async (oldValue) => {
        const change = new DeletedNode(
          this.node,
          context.requestContext,
          oldValue,
          deletedAt,
        );

        // Let's everybody know about this deleted node
        context.trackChange(change);

        // Apply the "postDelete"-hook
        await this.#config?.postDelete?.({
          gp: this.gp,
          node: this.node,
          context,
          api: createContextBoundAPI(this.gp, context),
          change,
        });

        return args.selection.parseValue(oldValue);
      },
      { path },
    );
  }
}
