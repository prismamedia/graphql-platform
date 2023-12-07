import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import { NodeCreation } from '../../../change.js';
import { NodeCreationStatement } from '../../../statement/creation.js';
import type { NodeFilter } from '../../../statement/filter.js';
import type { NodeSelectedValue } from '../../../statement/selection.js';
import type { NodeCreationInputValue } from '../../../type/input/creation.js';
import {
  ConnectorOperationKind,
  LifecycleHookError,
  LifecycleHookKind,
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
  TRequestContext,
  CreateSomeMutationArgs,
  CreateSomeMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'create-some';
  public readonly name = `create${this.node.plural}`;
  public readonly description = `Creates some "${this.node}", throws an error if they already exist`;

  @Memoize()
  public get arguments() {
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
    // As the "data" will be provided to the hooks, we freeze it
    Object.freeze(args.data);

    if (args.data.length === 0) {
      return [];
    }

    // Build the "creation" statements based on the provided "data" argument
    const creations = await Promise.all(
      args.data.map(async (data, index) => {
        const indexedPath =
          args.data.length > 1 ? utils.addPath(path, index) : path;

        // As the "data" will be provided to the hooks, we freeze it
        Object.freeze(data);

        // Resolve the edges' nested-actions into their value
        const value = await this.node.creationInputType.resolveValue(
          data,
          context,
          indexedPath,
        );

        // Create a statement with it
        const statement = new NodeCreationStatement(this.node, value);

        // Apply the "preCreate"-hook, if any
        try {
          await this.node.preCreate({
            context,
            data,
            creation: statement.proxy,
          });
        } catch (cause) {
          throw new LifecycleHookError(
            this.node,
            LifecycleHookKind.PRE_CREATE,
            { cause, path: indexedPath },
          );
        }

        return statement;
      }),
    );

    // Actually create the nodes
    const newValues = await catchConnectorOperationError(
      () => this.connector.create(context, { node: this.node, creations }),
      this.node,
      ConnectorOperationKind.CREATE,
      { path },
    );

    await Promise.all(
      newValues.map(async (newValue, index) => {
        const indexedPath =
          newValues.length > 1 ? utils.addPath(path, index) : path;

        const change = new NodeCreation(this.node, context.request, newValue);

        // Let's everybody know about this created node
        context.changes.push(change);

        // The "data" has been frozen above
        const data = args.data[index];

        // Apply the reverse-edges' actions
        await this.node.creationInputType.applyReverseEdgeActions(
          change.newValue,
          data,
          context,
          indexedPath,
        );

        // Apply the "postCreate"-hook, if any
        try {
          await this.node.postCreate({ context, data, change });
        } catch (cause) {
          throw new LifecycleHookError(
            this.node,
            LifecycleHookKind.POST_CREATE,
            { cause, path: indexedPath },
          );
        }
      }),
    );

    return this.node.selection.isSupersetOf(args.selection)
      ? newValues.map((newValue, index) =>
          args.selection.parseValue(newValue, utils.addPath(path, index)),
        )
      : this.node.getQueryByKey('get-some-in-order').internal(
          context,
          authorization,
          {
            where: newValues.map((newValue) =>
              this.node.mainIdentifier.parseValue(newValue),
            ),
            selection: args.selection,
          },
          path,
        );
  }
}
