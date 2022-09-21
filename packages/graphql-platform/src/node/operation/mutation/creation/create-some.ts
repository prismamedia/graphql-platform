import {
  addPath,
  aggregateConcurrentError,
  Input,
  ListableInputType,
  MutationType,
  nonNillableInputType,
  type NonNillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import assert from 'node:assert/strict';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type { NodeValue } from '../../../../node.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { CreatedNode } from '../../../change.js';
import type { NodeCreation } from '../../../statement/creation.js';
import type { NodeSelectedValue } from '../../../statement/selection.js';
import type { NodeCreationInputValue } from '../../../type/input/creation.js';
import { createContextBoundAPI } from '../../api.js';
import { AbstractCreation, type CreationConfig } from '../abstract-creation.js';
import type { MutationContext } from '../context.js';

export type CreateSomeMutationArgs = RawNodeSelectionAwareArgs<{
  data: ReadonlyArray<NonNillable<NodeCreationInputValue>>;
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
    this.node.getMutationConfig(MutationType.CREATION).config;
  readonly #configPath: Path = this.node.getMutationConfig(
    MutationType.CREATION,
  ).configPath;

  protected override readonly selectionAware = true;
  public override readonly name = `create${this.node.plural}`;
  public override readonly description = `Creates some "${this.node.name}", throws an error if they already exist`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'data',
        type: nonNillableInputType(
          new ListableInputType(
            nonNillableInputType(this.node.creationInputType),
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
    args: NodeSelectionAwareArgs<CreateSomeMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<CreateSomeMutationResult> {
    if (args.data.length === 0) {
      return [];
    }

    // Build the "creation" statements based on the provided "data" argument
    const creations = await aggregateConcurrentError(
      args.data,
      async (data, index) => {
        // As the "data" will be provided to the hooks, we freeze it
        Object.freeze(data);

        const creation: NodeCreation =
          await this.node.creationInputType.createStatement(
            data,
            context,
            addPath(path, index),
          );

        // Apply the "preCreate"-hook
        await this.#config?.preCreate?.({
          gp: this.gp,
          node: this.node,
          context,
          api: createContextBoundAPI(this.gp, context),
          data,
          creation: creation.proxy,
        });

        return creation;
      },
      { path },
    );

    // Actually create the nodes
    const newValues = await this.connector.create(
      { node: this.node, creations },
      context,
    );

    const createdAt = new Date();

    // It's the connector's responsability to ensure that
    assert.equal(
      newValues.length,
      creations.length,
      `The connector did not return a valid result`,
    );

    await aggregateConcurrentError<NodeValue, void>(
      newValues,
      async (newValue, index) => {
        const change = new CreatedNode(
          this.node,
          context.requestContext,
          newValue,
          createdAt,
        );

        // Let's everybody know about this created node
        context.trackChange(change);

        const data = args.data[index];

        // Apply the reverse-edges' actions
        await this.node.creationInputType.applyReverseEdgeActions(
          change.newValue,
          data,
          context,
          addPath(path, index),
        );

        // Apply the "postCreate"-hook
        await this.#config?.postCreate?.({
          gp: this.gp,
          node: this.node,
          context,
          api: createContextBoundAPI(this.gp, context),
          data,
          change,
        });
      },
      { path },
    );

    return this.node.selection.includes(args.selection)
      ? newValues.map((newValue) => args.selection.parseValue(newValue))
      : this.node.getQueryByKey('get-some-in-order').execute(
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
