import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement.js';
import type {
  NodeFilterInputValue,
  NodeUniqueFilterInputValue,
} from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type ExistsQueryArgs = {
  where: NodeUniqueFilterInputValue;
  subset?: NodeFilterInputValue;
};

export type ExistsQueryResult = boolean;

export class ExistsQuery<TRequestContext extends object> extends AbstractQuery<
  ExistsQueryArgs,
  ExistsQueryResult,
  TRequestContext
> {
  protected readonly selectionAware = false;

  public readonly key = 'exists';
  public readonly name = `${inflection.camelize(this.node.name, true)}Exists`;
  public override readonly description = `Either the "${this.node}" exists or not?`;

  @MGetter
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
      new utils.Input({
        name: 'subset',
        description:
          'It is possible to provide a filter in order to perform this operation in a subset of the documents',
        type: this.node.filterInputType,
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
      .internal(
        context,
        authorization,
        { where: { AND: [args.where, args.subset] } },
        path,
      );

    return count > 0;
  }
}
