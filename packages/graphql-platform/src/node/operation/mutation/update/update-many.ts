import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import * as R from 'remeda';
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
  type NodeSelectedValue,
  type NodeUpdateValue,
} from '../../../statement.js';
import type {
  NodeFilterInputValue,
  NodeUpdateInputValue,
  OrderByInputValue,
} from '../../../type.js';
import { catchConnectorOperationError } from '../../error.js';
import { AbstractUpdate } from '../abstract-update.js';
import type { MutationContext } from '../context.js';

export type UpdateManyMutationArgs = RawNodeSelectionAwareArgs<{
  data?: NodeUpdateInputValue;
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  first: number;
}>;

export type UpdateManyMutationResult = NodeSelectedValue[];

export class UpdateManyMutation<
  TRequestContext extends object,
> extends AbstractUpdate<
  UpdateManyMutationArgs,
  UpdateManyMutationResult,
  TRequestContext,
  ConnectorInterface
> {
  protected readonly selectionAware = true;

  public readonly key = 'update-many';
  public readonly name = `update${this.node.plural}`;
  public override readonly description = `Updates many "${this.node.plural}"`;

  @MGetter
  public override get arguments() {
    return [
      new utils.Input({
        name: 'data',
        type: this.node.updateInputType,
      }),
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
      this.connector.find.bind(
        this.connector,
        context,
        {
          node: this.node,
          ...(filter && { filter }),
          ...(ordering && { ordering }),
          limit: args.first,
          selection: this.node.selection,
          forMutation: this.node.updateInputType.hasComponentUpdates(data)
            ? utils.MutationType.UPDATE
            : undefined,
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
      // We assume that the "postUpdate"-hooks can change the reverse-edges
      (this.node.hasPostUpdateHooks ||
        this.node.updateInputType.hasReverseEdgeActions(
          data,
          args.selection.reverseEdges,
        ));

    // Resolve the edges' nested-actions into their value
    const update: NodeUpdateValue =
      await this.node.updateInputType.resolveUpdate(
        oldSources,
        data,
        context,
        path,
      );

    const hasVirtualData = this.node.updateInputType.hasVirtualData(data);

    let hasUpdate = false;

    for (const [index, oldSource] of oldSources.entries()) {
      // Create a statement for it
      const statement = new NodeUpdateStatement(this.node, oldSource, update);

      if (!statement.isEmpty() || hasVirtualData) {
        // Apply the "preUpdate"-hooks, if any
        await this.node.preUpdate(
          {
            context,
            data,
            id: ids[index],
            current: oldSource,
            update: statement.updateProxy,
            target: statement.targetProxy,
            statement,
          },
          path,
        );

        if (!statement.isEmpty()) {
          // Actually update the node
          await catchConnectorOperationError(
            this.connector.update.bind(
              this.connector,
              context,
              {
                node: this.node,
                update: statement,
                filter: this.node.filterInputType.filter(ids[index]),
              },
              path,
            ),
            context.request,
            this.node,
            {
              mutatedValue: statement.current,
              mutationType: utils.MutationType.UPDATE,
              path,
            },
          );

          hasUpdate ||= true;
        }
      }
    }

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
        R.map(
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
      context.changes.add(...changes);
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

    // Apply the "postUpdate"-hooks, if any
    if (this.node.hasPostUpdateHooks) {
      for (const change of changes) {
        await this.node.postUpdate({
          context,
          data,
          change,
        });
      }
    }

    return willEventuallyRefetch
      ? this.node
          .getQueryByKey('get-some-in-order')
          .internal(
            context,
            undefined,
            { where: ids, selection: args.selection },
            path,
          )
      : newValues.map((newValue) => args.selection.pickValue(newValue));
  }
}
