import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import { NodeValue } from '../../../../node.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { UpdatedNode } from '../../../change.js';
import { AndOperation, NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection.js';
import type { NodeUpdate } from '../../../statement/update.js';
import type { NodeFilterInputValue } from '../../../type/input/filter.js';
import type { OrderByInputValue } from '../../../type/input/ordering.js';
import { createContextBoundAPI } from '../../api.js';
import {
  catchConnectorError,
  catchLifecycleHookError,
  LifecycleHookKind,
} from '../../error.js';
import { AbstractUpdate, type UpdateConfig } from '../abstract-update.js';
import type { MutationContext } from '../context.js';

export type UpdateManyMutationArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  first: number;
  data: utils.PlainObject;
}>;

export type UpdateManyMutationResult = NodeSelectedValue[];

export class UpdateManyMutation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractUpdate<
  TRequestContext,
  TConnector,
  UpdateManyMutationArgs,
  UpdateManyMutationResult
> {
  readonly #config?: UpdateConfig<TRequestContext, TConnector> =
    this.node.getMutationConfig(utils.MutationType.UPDATE).config;
  readonly #configPath: utils.Path = this.node.getMutationConfig(
    utils.MutationType.UPDATE,
  ).configPath;

  protected override readonly selectionAware = true;
  public override readonly name = `update${this.node.plural}`;
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
        type: utils.nonNillableInputType(this.node.updateInputType),
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
    { data, ...args }: NodeSelectionAwareArgs<UpdateManyMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<UpdateManyMutationResult> {
    if (Object.keys(data).length === 0) {
      // An "empty" update is just a "find"
      return this.node
        .getQueryByKey('find-many')
        .internal(authorization, args, context, path);
    } else {
      // As the "data" will be provided to the hooks, we freeze it
      Object.freeze(data);
    }

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

    const currentValues = (await catchConnectorError(
      () =>
        this.connector.find(
          {
            node: this.node,
            ...(filter && { filter }),
            ...(ordering && { ordering }),
            limit: args.first,
            selection: this.node.selection,
            forMutation: utils.MutationType.UPDATE,
          },
          context,
        ),
      path,
    )) as NodeValue[];

    if (currentValues.length === 0) {
      return [];
    }

    const currentIds = currentValues.map((currentValue) =>
      this.node.identifier.parseValue(currentValue),
    );

    const update: NodeUpdate = await this.node.updateInputType.createStatement(
      data,
      context,
      path,
    );

    if (update.updatesByComponent.size) {
      if (this.#config?.preUpdate) {
        await Promise.all(
          currentValues.map(async (currentValue, index) => {
            // Because we provide the "currentValue", the update might be "individualized/customized" using it
            const individualizedUpdate = update.clone();

            // Apply the "preUpdate"-hook
            await catchLifecycleHookError(
              () =>
                this.#config!.preUpdate!({
                  gp: this.gp,
                  node: this.node,
                  context,
                  api: createContextBoundAPI(this.gp, context),
                  data,
                  currentValue: Object.freeze(
                    this.node.parseValue(currentValue),
                  ),
                  update: individualizedUpdate.proxy,
                }),
              this.node,
              LifecycleHookKind.PRE_UPDATE,
              path,
            );

            if (individualizedUpdate.updatesByComponent.size) {
              // Actually update the node
              await catchConnectorError(
                () =>
                  this.connector.update(
                    {
                      node: this.node,
                      update: individualizedUpdate,
                      filter: this.node.filterInputType.parseAndFilter(
                        currentIds[index],
                      ),
                    },
                    context,
                  ),
                path,
              );
            }
          }),
        );
      } else {
        // Actually update the nodes
        await catchConnectorError(
          () =>
            this.connector.update(
              {
                node: this.node,
                update,
                filter: this.node.filterInputType.parseAndFilter({
                  OR: currentIds,
                }),
              },
              context,
            ),
          path,
        );
      }
    }

    const maybeUpdateAfterwards =
      (this.node.updateInputType.hasReverseEdgeActions(data) ||
        this.#config?.postUpdate != null) &&
      !this.node.selection.includes(args.selection);

    const newValues = (await this.node
      .getQueryByKey('get-some-in-order')
      .internal(
        authorization,
        {
          where: currentIds,
          selection: maybeUpdateAfterwards
            ? this.node.selection
            : this.node.selection.mergeWith(args.selection),
        },
        context,
        path,
      )) as NodeValue[];

    const changes = currentValues.reduce<UpdatedNode[]>(
      (changes, oldValue, index) => {
        const change = new UpdatedNode(
          this.node,
          context.requestContext,
          oldValue,
          newValues[index],
        );

        if (change.updatesByComponent.size) {
          // Let's everybody know about the update, if any
          context.changes.push(change);

          changes.push(change);
        }

        return changes;
      },
      [],
    );

    // Apply the reverse-edges' actions
    if (this.node.updateInputType.hasReverseEdgeActions(data)) {
      await Promise.all(
        newValues.map((newValue) =>
          this.node.updateInputType.applyReverseEdgeActions(
            newValue,
            data,
            context,
            path,
          ),
        ),
      );
    }

    // Apply the "postUpdate"-hook
    if (this.#config?.postUpdate) {
      await Promise.all(
        changes.map((change) =>
          catchLifecycleHookError(
            () =>
              this.#config!.postUpdate!({
                gp: this.gp,
                node: this.node,
                context,
                api: createContextBoundAPI(this.gp, context),
                data,
                change,
              }),
            this.node,
            LifecycleHookKind.POST_UPDATE,
            path,
          ),
        ),
      );
    }

    return maybeUpdateAfterwards
      ? this.node.getQueryByKey('get-some-in-order').internal(
          authorization,
          {
            where: currentIds,
            selection: args.selection,
          },
          context,
          path,
        )
      : newValues.map((newValue) => args.selection.parseValue(newValue));
  }
}
