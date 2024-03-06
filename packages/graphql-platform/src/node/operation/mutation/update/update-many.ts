import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import * as R from 'remeda';
import type { BrokerInterface } from '../../../../broker-interface.js';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type { NodeValue } from '../../../../node.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { NodeUpdate } from '../../../change.js';
import type { UniqueConstraintValue } from '../../../definition.js';
import {
  NodeFilter,
  NodeUpdateStatement,
  NodeUpdateValue,
  type NodeSelectedValue,
} from '../../../statement.js';
import type {
  NodeFilterInputValue,
  NodeUpdateInputValue,
  OrderByInputValue,
} from '../../../type.js';
import {
  catchConnectorOperationError,
  ConnectorOperationKind,
  LifecycleHookError,
  LifecycleHookKind,
} from '../../error.js';
import { AbstractUpdate } from '../abstract-update.js';
import type { MutationContext } from '../context.js';

export type UpdateManyMutationArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  first: number;
  data?: NodeUpdateInputValue;
}>;

export type UpdateManyMutationResult = NodeSelectedValue[];

export class UpdateManyMutation<
  TRequestContext extends object,
> extends AbstractUpdate<
  TRequestContext,
  ConnectorInterface,
  BrokerInterface,
  object,
  UpdateManyMutationArgs,
  UpdateManyMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'update-many';
  public readonly name = `update${this.node.plural}`;
  public override readonly description = `Updates many "${this.node.plural}"`;

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
      new utils.Input({
        name: 'data',
        type: this.node.updateInputType,
      }),
    ];
  }

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
    { data, ...args }: NodeSelectionAwareArgs<UpdateManyMutationArgs>,
    path: utils.Path,
  ): Promise<UpdateManyMutationResult> {
    if (!args.first) {
      return [];
    } else if (!data || !Object.keys(data).length) {
      // An "empty" update is just a "find"
      return this.node
        .getQueryByKey('find-many')
        .internal(context, authorization, args, path);
    }

    // As the "data" will be provided to the hooks, we freeze it
    Object.freeze(data);

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

    // Fetch the current nodes' source
    const rawOldSources = await catchConnectorOperationError(
      () =>
        this.connector.find(context, {
          node: this.node,
          ...(filter && { filter }),
          ...(ordering && { ordering }),
          limit: args.first,
          selection: this.node.selection,
          forMutation: utils.MutationType.UPDATE,
        }),
      this.node,
      ConnectorOperationKind.FIND,
      { path },
    );

    if (!rawOldSources.length) {
      return [];
    }

    const oldSources: NodeValue[] = [];
    const ids: UniqueConstraintValue[] = [];

    for (const rawOldSource of rawOldSources) {
      const oldSource = this.node.selection.parseSource(rawOldSource, path);
      oldSources.push(oldSource);

      const id = this.node.mainIdentifier.selection.pickValue(oldSource);
      ids.push(id);
    }

    const willEventuallyRefetch =
      args.selection.reverseEdges.length &&
      // We assume that the "postUpdate"-hook can change the reverse-edges
      (this.node.postUpdateHooks.length ||
        this.node.updateInputType.hasActionOnSelectedReverseEdge(
          data,
          args.selection,
        ));

    // Resolve the edges' nested-actions into their value
    const update: NodeUpdateValue =
      await this.node.updateInputType.resolveUpdate(
        oldSources,
        data,
        context,
        path,
      );

    let hasUpdate = false;

    await Promise.all(
      oldSources.map(async (oldSource, index) => {
        // Create a statement for it
        const statement = new NodeUpdateStatement(this.node, oldSource, update);

        if (!statement.isEmpty()) {
          // Apply the "preUpdate"-hook, if any
          try {
            await this.node.preUpdate({
              context,
              data,
              id: Object.freeze(ids[index]),
              current: Object.freeze(oldSource),
              update: statement.updateProxy,
              target: statement.targetProxy,
            });
          } catch (cause) {
            throw new LifecycleHookError(
              this.node,
              LifecycleHookKind.PRE_UPDATE,
              { cause, path },
            );
          }

          if (!statement.isEmpty()) {
            // Actually update the node
            await catchConnectorOperationError(
              () =>
                this.connector.update(context, {
                  node: this.node,
                  update: statement,
                  filter: this.node.filterInputType.filter(ids[index]),
                }),
              this.node,
              ConnectorOperationKind.UPDATE,
              { path },
            );

            hasUpdate ||= true;
          }
        }
      }),
    );

    let newValues: NodeSelectedValue[];
    let changes: NodeUpdate[];

    if (hasUpdate) {
      newValues = await this.node.getQueryByKey('get-some-in-order').internal(
        context,
        undefined,
        {
          where: ids,
          selection: willEventuallyRefetch
            ? this.node.selection
            : this.node.selection.mergeWith(args.selection),
        },
        path,
      );

      changes = R.pipe(
        oldSources,
        R.map.indexed(
          (oldValue, index) =>
            new NodeUpdate(
              this.node,
              context.request,
              oldValue,
              newValues[index],
            ),
        ),
        R.filter((change) => !change.isEmpty()),
      );

      // Let's everybody know about the update, if any
      context.trackChanges(...changes);
    } else {
      newValues = willEventuallyRefetch
        ? oldSources
        : await this.node.getQueryByKey('get-some-in-order').internal(
            context,
            undefined,
            {
              where: ids,
              selection: this.node.selection.mergeWith(args.selection),
            },
            path,
          );

      changes = [];
    }

    // Apply the reverse-edges' actions
    await this.node.updateInputType.applyReverseEdgeActions(
      newValues,
      data,
      context,
      path,
    );

    // Apply the "postUpdate"-hook
    if (this.node.postUpdateHooks.length) {
      await Promise.all(
        changes.map(async (change) => {
          try {
            await this.node.postUpdate({
              context,
              data,
              change,
            });
          } catch (cause) {
            throw new LifecycleHookError(
              this.node,
              LifecycleHookKind.POST_UPDATE,
              { cause, path },
            );
          }
        }),
      );
    }

    return willEventuallyRefetch
      ? this.node.getQueryByKey('get-some-in-order').internal(
          context,
          undefined,
          {
            where: ids,
            selection: args.selection,
          },
          path,
        )
      : newValues.map((newValue) => args.selection.pickValue(newValue));
  }
}
