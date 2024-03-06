import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement.js';
import type { NodeUniqueFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type ExistsQueryArgs = { where: NodeUniqueFilterInputValue };

export type ExistsQueryResult = boolean;

export class ExistsQuery<TRequestContext extends object> extends AbstractQuery<
  TRequestContext,
  ConnectorInterface,
  BrokerInterface,
  object,
  ExistsQueryArgs,
  ExistsQueryResult
> {
  protected readonly selectionAware = false;

  public readonly key = 'exists';
  public readonly name = `${inflection.camelize(this.node.name, true)}Exists`;
  public override readonly description = `Either the "${this.node}" exists or not?`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
    ];
  }

  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(scalars.typesByName.Boolean);
  }

  protected async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<ExistsQueryArgs>,
    path: utils.Path,
  ): Promise<ExistsQueryResult> {
    const count = await this.node
      .getQueryByKey('count')
      .internal(context, authorization, args, path);

    return count > 0;
  }
}
