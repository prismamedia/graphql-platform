import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { NodeValue } from '../../../../node.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { NodeUpdate } from '../../../change.js';
import { AndOperation, NodeFilter } from '../../../statement/filter.js';
import {
  isReverseEdgeSelection,
  type NodeSelectedValue,
} from '../../../statement/selection.js';
import {
  NodeUpdateStatement,
  NodeUpdateValue,
} from '../../../statement/update.js';
import type { NodeFilterInputValue } from '../../../type/input/filter.js';
import type { OrderByInputValue } from '../../../type/input/ordering.js';
import type { NodeUpdateInputValue } from '../../../type/input/update.js';
import {
  catchConnectorOperationError,
  ConnectorOperationKind,
  LifecycleHookError,
  LifecycleHookKind,
} from '../../error.js';
import { AbstractUpdate, type UpdateConfig } from '../abstract-update.js';
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
  UpdateManyMutationArgs,
  UpdateManyMutationResult
> {
  readonly #config?: UpdateConfig<any, any, any> = this.node.getMutationConfig(
    utils.MutationType.UPDATE,
  ).config;

  protected readonly selectionAware = true;

  public readonly key = 'update-many';
  public readonly name = `update${this.node.plural}`;
  public readonly description = `Updates many "${this.node.plural}"`;

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
      new utils.Input({
        name: 'data',
        type: this.node.updateInputType,
      }),
    ];
  }

  public getGraphQLOutputType() {
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
    const preUpdate = this.#config?.preUpdate;
    const postUpdate = this.#config?.postUpdate;

    // As the "data" will be provided to the hooks, we freeze it
    Object.freeze(data);

    if (args.first === 0) {
      return [];
    } else if (!data || Object.keys(data).length === 0) {
      // An "empty" update is just a "find"
      return this.node
        .getQueryByKey('find-many')
        .internal(context, authorization, args, path);
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
    const currentValues = await catchConnectorOperationError(
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

    if (currentValues.length === 0) {
      return [];
    }

    const willEventuallyRefetchToGetReverseEdgeChanges =
      // We assume that the "postUpdate"-hook can change the reverse-edges
      (postUpdate &&
        args.selection.expressions.some((expression) =>
          isReverseEdgeSelection(expression),
        )) ||
      this.node.updateInputType.hasActionOnSelectedReverseEdge(
        data,
        args.selection,
      );

    const currentIds = currentValues.map((currentValue) =>
      this.node.identifier.parseValue(currentValue),
    );

    // Resolve the edges' nested-actions into their value
    const update: NodeUpdateValue =
      await this.node.updateInputType.resolveUpdate(
        currentValues,
        data,
        context,
        path,
      );

    let newValues: ReadonlyArray<NodeValue>;
    let changes: ReadonlyArray<NodeUpdate>;

    if (Object.keys(update).length) {
      await Promise.all(
        currentValues.map(async (currentValue, index) => {
          // Create a statement for it
          const statement = new NodeUpdateStatement(
            this.node,
            currentValue,
            update,
          );

          if (!statement.isEmpty()) {
            // Apply the "preUpdate"-hook
            try {
              await preUpdate?.({
                gp: this.gp,
                node: this.node,
                context,
                api: context.api,
                data,
                id: Object.freeze(currentIds[index]),
                current: Object.freeze(this.node.parseValue(currentValue)),
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
                    filter: this.node.filterInputType.filter(currentIds[index]),
                  }),
                this.node,
                ConnectorOperationKind.UPDATE,
                { path },
              );
            }
          }
        }),
      );

      newValues = await this.node.getQueryByKey('get-some-in-order').internal(
        context,
        undefined,
        {
          where: currentIds,
          selection: willEventuallyRefetchToGetReverseEdgeChanges
            ? this.node.selection
            : this.node.selection.mergeWith(args.selection),
        },
        path,
      );

      changes = currentValues.reduce<NodeUpdate[]>(
        (changes, oldValue, index) => {
          const change = new NodeUpdate(
            this.node,
            context.request,
            oldValue,
            newValues[index],
          );

          if (!change.isEmpty()) {
            // Let's everybody know about the update, if any
            context.appendChange(change);

            changes.push(change);
          }

          return changes;
        },
        [],
      );
    } else {
      newValues = willEventuallyRefetchToGetReverseEdgeChanges
        ? currentValues
        : await this.node.getQueryByKey('get-some-in-order').internal(
            context,
            undefined,
            {
              where: currentIds,
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
    if (changes.length && postUpdate) {
      await Promise.all(
        changes.map(async (change) => {
          try {
            await postUpdate({
              gp: this.gp,
              node: this.node,
              context,
              api: context.api,
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

    return willEventuallyRefetchToGetReverseEdgeChanges
      ? this.node.getQueryByKey('get-some-in-order').internal(
          context,
          undefined,
          {
            where: currentIds,
            selection: args.selection,
          },
          path,
        )
      : newValues.map((newValue) => args.selection.parseValue(newValue));
  }
}
