import type * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';
import { NotFoundError } from '../error.js';
import type {
  GetOneIfExistsQueryArgs,
  GetOneIfExistsQueryResult,
} from './get-one-if-exists.js';

export type GetOneQueryArgs = GetOneIfExistsQueryArgs;

export type GetOneQueryResult = NonNullable<GetOneIfExistsQueryResult>;

export class GetOneQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  GetOneQueryArgs,
  GetOneQueryResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = inflection.camelize(this.node.name, true);
  public override readonly description = `Retrieves one "${this.node}", throws an error if it does not exist`;

  @Memoize()
  public override get arguments() {
    return this.node.getQueryByKey('get-one-if-exists').arguments;
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      this.node.outputType.getGraphQLObjectType(),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: NodeSelectionAwareArgs<GetOneQueryArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<GetOneQueryResult> {
    const nodeValue = await this.node
      .getQueryByKey('get-one-if-exists')
      .internal(authorization, args, context, path);

    if (!nodeValue) {
      throw new NotFoundError(this.node, args.where, { path });
    }

    return nodeValue;
  }
}
