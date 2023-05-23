import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import { type NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import type { NodeUniqueFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type ExistsQueryArgs = { where: NodeUniqueFilterInputValue };

export type ExistsQueryResult = boolean;

export class ExistsQuery<TRequestContext extends object> extends AbstractQuery<
  TRequestContext,
  ExistsQueryArgs,
  ExistsQueryResult
> {
  protected override readonly selectionAware = false;
  public override readonly name = `${inflection.camelize(
    this.node.name,
    true,
  )}Exists`;
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

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(scalars.typesByName.Boolean);
  }

  protected override async executeWithValidArgumentsAndContext(
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
