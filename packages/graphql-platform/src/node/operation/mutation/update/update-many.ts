import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  Input,
  ListableInputType,
  MutationType,
  nonNillableInputType,
  type Path,
  type PlainObject,
} from '@prismamedia/graphql-platform-utils';
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
import { AbstractUpdate, type UpdateConfig } from '../abstract-update.js';
import type { MutationContext } from '../context.js';

export type UpdateManyMutationArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  first: number;
  data: PlainObject;
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
    this.node.getMutationConfig(MutationType.UPDATE).config;
  readonly #configPath: Path = this.node.getMutationConfig(MutationType.UPDATE)
    .configPath;

  protected override readonly selectionAware = true;
  public override readonly name = `update${this.node.plural}`;
  public override readonly description = `Updates many "${this.node.plural}"`;

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
      new Input({
        name: 'data',
        type: nonNillableInputType(this.node.updateInputType),
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
    args: NodeSelectionAwareArgs<UpdateManyMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<UpdateManyMutationResult> {
    // As the "data" will be provided to the hooks, we freeze it
    Object.freeze(args.data);

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
          MutationType.UPDATE,
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

    // An "empty" update is just a "find"
    if (!Object.values(args.data).length) {
      return this.connector.find(
        {
          node: this.node,
          ...(filter && { where: filter }),
          ...(ordering && { orderBy: ordering }),
          limit: args.first,
          selection: args.selection,
        },
        context,
      );
    }

    const currentValues = (await this.connector.find(
      {
        node: this.node,
        ...(filter && { where: filter }),
        ...(ordering && { orderBy: ordering }),
        limit: args.first,
        selection: this.node.selection,
        forMutation: MutationType.UPDATE,
      },
      context,
    )) as NodeValue[];

    if (currentValues.length === 0) {
      return [];
    }

    const ids = currentValues.map((currentValue) =>
      this.node.identifier.parseValue(currentValue),
    );

    const update: NodeUpdate = await this.node.updateInputType.createStatement(
      args.data,
      context,
      path,
    );

    let updatedAt: Date | undefined;
    let newValues: NodeValue[];

    if (update.updatesByComponent.size) {
      if (this.#config?.preUpdate) {
        await Promise.all(
          currentValues.map(async (currentValue) => {
            // Because we provide the "currentValue", the update might be "individualized/customized" using it
            const maybeIndividualizedUpdate = update.clone();

            // Apply the "preUpdate"-hook
            await this.#config!.preUpdate!({
              gp: this.gp,
              node: this.node,
              context,
              api: createContextBoundAPI(this.gp, context),
              data: args.data,
              currentValue: Object.freeze(this.node.parseValue(currentValue)),
              update: maybeIndividualizedUpdate.proxy,
            });

            if (maybeIndividualizedUpdate.updatesByComponent.size) {
              // Actually update the node
              await this.connector.update(
                {
                  node: this.node,
                  where: this.node.filterInputType.parseAndFilter(
                    this.node.identifier.parseValue(currentValue),
                  ),
                  limit: 1,
                  update: maybeIndividualizedUpdate,
                },
                context,
              );
            }
          }),
        );
      } else {
        // Actually update the nodes
        await this.connector.update(
          {
            node: this.node,
            where: this.node.filterInputType.parseAndFilter({ OR: ids }),
            limit: ids.length,
            update,
          },
          context,
        );
      }

      updatedAt = new Date();
      newValues = (await this.node.getQuery('get-some-in-order').execute(
        {
          where: ids,
          selection: this.node.selection,
        },
        context,
        path,
      )) as NodeValue[];
    } else {
      newValues = currentValues;
    }

    const changes = currentValues.map((oldValue, index) => {
      const change = new UpdatedNode(
        this.node,
        context.requestContext,
        oldValue,
        newValues[index],
        updatedAt,
      );

      // Let's everybody know about the changes, if any
      if (change.hasDifference()) {
        context.trackChange(change);
      }

      return change;
    });

    // Apply the reverse-edges' actions
    if (this.node.updateInputType.hasReverseEdgeActions(args.data)) {
      await Promise.all(
        changes.map((change) =>
          this.node.updateInputType.applyReverseEdgeActions(
            change.newValue,
            args.data,
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
          this.#config!.postUpdate!({
            gp: this.gp,
            node: this.node,
            context,
            api: createContextBoundAPI(this.gp, context),
            data: args.data,
            change,
          }),
        ),
      );
    }

    return this.node.getQuery('get-some-in-order').execute(
      {
        where: ids,
        selection: args.selection,
      },
      context,
      path,
    );
  }
}
