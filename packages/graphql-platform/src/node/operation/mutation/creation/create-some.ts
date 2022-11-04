import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { NodeCreation } from '../../../change.js';
import { NodeCreationStatement } from '../../../statement.js';
import type { NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection.js';
import type { NodeCreationInputValue } from '../../../type/input/creation.js';
import { createContextBoundAPI } from '../../api.js';
import {
  catchConnectorError,
  catchLifecycleHookError,
  LifecycleHookKind,
} from '../../error.js';
import { AbstractCreation, type CreationConfig } from '../abstract-creation.js';
import type { MutationContext } from '../context.js';

export type CreateSomeMutationArgs = RawNodeSelectionAwareArgs<{
  data: ReadonlyArray<utils.NonNillable<NodeCreationInputValue>>;
}>;

export type CreateSomeMutationResult = NodeSelectedValue[];

export class CreateSomeMutation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractCreation<
  TRequestContext,
  TConnector,
  CreateSomeMutationArgs,
  CreateSomeMutationResult
> {
  readonly #config?: CreationConfig<TRequestContext, TConnector> =
    this.node.getMutationConfig(utils.MutationType.CREATION).config;
  readonly #configPath: utils.Path = this.node.getMutationConfig(
    utils.MutationType.CREATION,
  ).configPath;

  protected override readonly selectionAware = true;
  public override readonly name = `create${this.node.plural}`;
  public override readonly description = `Creates some "${this.node}", throws an error if they already exist`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'data',
        type: utils.nonNillableInputType(
          new utils.ListableInputType(
            utils.nonNillableInputType(this.node.creationInputType),
          ),
        ),
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
    args: NodeSelectionAwareArgs<CreateSomeMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<CreateSomeMutationResult> {
    if (args.data.length === 0) {
      return [];
    }

    // Build the "creation" statements based on the provided "data" argument
    const creations = await Promise.all(
      args.data.map(async (data, index) => {
        // As the "data" will be provided to the hooks, we freeze it
        Object.freeze(data);

        const creation: NodeCreationStatement =
          await this.node.creationInputType.createStatement(
            data,
            context,
            utils.addPath(path, index),
          );

        // Apply the "preCreate"-hook, if any
        if (this.#config?.preCreate) {
          await catchLifecycleHookError(
            () =>
              this.#config!.preCreate!({
                gp: this.gp,
                node: this.node,
                context,
                api: createContextBoundAPI(this.gp, context),
                data,
                creation: creation.proxy,
              }),
            this.node,
            LifecycleHookKind.PRE_CREATE,
            utils.addPath(path, index),
          );
        }

        return creation;
      }),
    );

    // Actually create the nodes
    const newValues = await catchConnectorError(
      () => this.connector.create({ node: this.node, creations }, context),
      path,
    );

    await Promise.all(
      newValues.map(async (newValue, index) => {
        const change = new NodeCreation(
          this.node,
          context.requestContext,
          newValue,
        );

        // Let's everybody know about this created node
        context.changes.push(change);

        // The "data" has been frozen above
        const data = args.data[index];

        // Apply the reverse-edges' actions
        await this.node.creationInputType.applyReverseEdgeActions(
          change.newValue,
          data,
          context,
          utils.addPath(path, index),
        );

        // Apply the "postCreate"-hook, if any
        if (this.#config?.postCreate) {
          await catchLifecycleHookError(
            () =>
              this.#config!.postCreate!({
                gp: this.gp,
                node: this.node,
                context,
                api: createContextBoundAPI(this.gp, context),
                data,
                change,
              }),
            this.node,
            LifecycleHookKind.POST_CREATE,
            utils.addPath(path, index),
          );
        }
      }),
    );

    return this.node.selection.includes(args.selection)
      ? newValues.map((newValue, index) =>
          args.selection.parseValue(newValue, utils.addPath(path, index)),
        )
      : this.node.getQueryByKey('get-some-in-order').internal(
          authorization,
          {
            where: newValues.map((newValue) =>
              this.node.identifier.parseValue(newValue),
            ),
            selection: args.selection,
          },
          context,
          path,
        );
  }
}
