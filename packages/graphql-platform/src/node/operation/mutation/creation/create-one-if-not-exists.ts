import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import type { BrokerInterface } from '../../../../broker-interface.js';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import type { NodeFilter, NodeSelectedValue } from '../../../statement.js';
import type {
  NodeCreationInputValue,
  NodeUniqueFilterInputValue,
} from '../../../type.js';
import { AbstractCreation } from '../abstract-creation.js';
import type { MutationContext } from './../context.js';

export type CreateOneIfNotExistsMutationArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
  data: NonNullable<NodeCreationInputValue>;
}>;

export type CreateOneIfNotExistsMutationResult = NodeSelectedValue;

/**
 * This mutation is the same as an upsert without update but it does not require the "update" authorization nor the "mutability"
 */
export class CreateOneIfNotExistsMutation<
  TRequestContext extends object,
> extends AbstractCreation<
  TRequestContext,
  ConnectorInterface,
  BrokerInterface,
  object,
  CreateOneIfNotExistsMutationArgs,
  CreateOneIfNotExistsMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'create-one-if-not-exists';
  public readonly name = `create${this.node}IfNotExists`;
  public override readonly description = `Creates one "${this.node}" if it does not exist, returns the existing otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
      new utils.Input({
        name: 'data',
        type: utils.nonNillableInputType(this.node.creationInputType),
      }),
    ];
  }

  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<CreateOneIfNotExistsMutationArgs>,
    path: utils.Path,
  ): Promise<CreateOneIfNotExistsMutationResult> {
    return (
      (await this.node
        .getQueryByKey('get-one-if-exists')
        .internal(
          context,
          authorization,
          { where: args.where, selection: args.selection },
          path,
        )) ??
      (await this.node
        .getMutationByKey('create-one')
        .internal(
          context,
          authorization,
          { data: args.data, selection: args.selection },
          path,
        ))
    );
  }
}
