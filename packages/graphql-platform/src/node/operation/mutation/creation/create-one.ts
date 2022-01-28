import {
  Input,
  nonNillableInputType,
  type NonNillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import type { NodeSelectedValue } from '../../../statement/selection/value.js';
import type { NodeCreationInputValue } from '../../../type/input/creation.js';
import { AbstractCreation } from '../abstract-creation.js';
import type { MutationContext } from './../context.js';

export type CreateOneMutationArgs = RawNodeSelectionAwareArgs<{
  data: NonNillable<NodeCreationInputValue>;
}>;

export type CreateOneMutationResult = NodeSelectedValue;

export class CreateOneMutation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractCreation<
  TRequestContext,
  TConnector,
  CreateOneMutationArgs,
  CreateOneMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `create${this.node.name}`;
  public override readonly description = `Creates one "${this.node.name}", throws an error if it already exists`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'data',
        type: nonNillableInputType(this.node.creationInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<CreateOneMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<CreateOneMutationResult> {
    const [nodeValue] = await this.node.getMutation('create-some').execute(
      {
        data: [args.data],
        selection: args.selection,
      },
      context,
      path,
    );

    return nodeValue;
  }
}
