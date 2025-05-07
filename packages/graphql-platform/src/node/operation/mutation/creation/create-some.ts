import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { NodeCreation } from '../../../change.js';
import type { NodeFilter, NodeSelectedValue } from '../../../statement.js';
import { NodeCreationStatement } from '../../../statement.js';
import type { NodeCreationInputValue } from '../../../type.js';
import {
  ConnectorOperationKind,
  catchConnectorOperationError,
} from '../../error.js';
import { AbstractCreation } from '../abstract-creation.js';
import type { MutationContext } from '../context.js';

export type CreateSomeMutationArgs = RawNodeSelectionAwareArgs<{
  data: ReadonlyArray<NonNullable<NodeCreationInputValue>>;
}>;

export type CreateSomeMutationResult = NodeSelectedValue[];

export class CreateSomeMutation<
  TRequestContext extends object,
> extends AbstractCreation<
  CreateSomeMutationArgs,
  CreateSomeMutationResult,
  TRequestContext,
  ConnectorInterface
> {
  protected readonly selectionAware = true;

  public readonly key = 'create-some';
  public readonly name = `create${this.node.plural}`;
  public override readonly description = `Creates some "${this.node}", throws an error if they already exist`;

  @MGetter
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
    args: NodeSelectionAwareArgs<CreateSomeMutationArgs>,
    path: utils.Path,
  ): Promise<CreateSomeMutationResult> {
    if (!args.data.length) {
      return [];
    }

    // Build the "creation" statements based on the provided "data" argument
    const creations: NodeCreationStatement[] = [];

    for (const [index, data] of args.data.entries()) {
      const indexedPath =
        args.data.length > 1 ? utils.addPath(path, index) : path;

      // Resolve the edges' nested-actions into their value
      const value = await this.node.creationInputType.resolveValue(
        data,
        context,
        indexedPath,
      );

      // Create a statement with it
      const statement = new NodeCreationStatement(this.node, value);

      // Apply the "preCreate"-hooks, if any
      await this.node.preCreate(
        { context, data, creation: statement.proxy, statement },
        indexedPath,
      );

      creations.push(statement);
    }

    // Actually create the nodes
    const rawNewSources = await catchConnectorOperationError(
      () =>
        this.connector.create(
          context,
          {
            node: this.node,
            creations,
          },
          path,
        ),
      context.request,
      this.node,
      ConnectorOperationKind.CREATE,
      { path },
    );

    const changes: NodeCreation[] = [];

    for (const [index, rawNewSource] of rawNewSources.entries()) {
      const change = new NodeCreation(this.node, context.request, rawNewSource);
      changes.push(change);

      // Let's everybody know about this created node
      context.changes.add(change);

      const data = args.data[index];

      const indexedPath =
        rawNewSources.length > 1 ? utils.addPath(path, index) : path;

      // Apply the reverse-edges' actions
      await this.node.creationInputType.applyReverseEdgeActions(
        change.newValue,
        data,
        context,
        indexedPath,
      );

      // Apply the "postCreate"-hooks, if any
      await this.node.postCreate({ context, data, change }, indexedPath);
    }

    return args.selection.isPure()
      ? changes.map((change) => args.selection.pickValue(change.newValue))
      : this.node
          .getQueryByKey('get-some-in-order')
          .internal(
            context,
            authorization,
            { where: changes.map(({ id }) => id), selection: args.selection },
            path,
          );
  }
}
