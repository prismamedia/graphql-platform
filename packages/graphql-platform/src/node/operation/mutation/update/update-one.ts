import type {
  NonNillable,
  Path,
  PlainObject,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import type { NodeSelectedValue } from '../../../statement/selection/value.js';
import type { NodeUniqueFilterInputValue } from '../../../type.js';
import { NotFoundError } from '../../error.js';
import { AbstractUpdate } from '../abstract-update.js';
import type { MutationContext } from '../context.js';

export type UpdateOneMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNillable<NodeUniqueFilterInputValue>;
  data: PlainObject;
}>;

export type UpdateOneMutationResult = NodeSelectedValue;

export class UpdateOneMutation<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractUpdate<
  TRequestContext,
  TConnector,
  UpdateOneMutationArgs,
  UpdateOneMutationResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `update${this.node.name}`;
  public override readonly description = `Updates one "${this.node.name}", throws an error if it does not exists`;

  @Memoize()
  public override get arguments() {
    return this.node.getMutation('update-one-if-exists').arguments;
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<UpdateOneMutationArgs>,
    context: MutationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<UpdateOneMutationResult> {
    const nodeValue = await this.node
      .getMutation('update-one-if-exists')
      .execute(args, context, path);

    if (!nodeValue) {
      throw new NotFoundError(this.node, args.where, { path });
    }

    return nodeValue;
  }
}
