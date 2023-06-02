import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import inflection from 'inflection';
import {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import type { NodeSelectedValue } from '../../statement/selection/value.js';
import type { NodeUniqueFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type GetOneIfExistsQueryArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
}>;

export type GetOneIfExistsQueryResult = NodeSelectedValue | null;

export class GetOneIfExistsQuery<
  TRequestContext extends object,
> extends AbstractQuery<
  TRequestContext,
  GetOneIfExistsQueryArgs,
  GetOneIfExistsQueryResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'get-one-if-exists';
  public readonly name = `${inflection.camelize(this.node.name, true)}IfExists`;
  public readonly description = `Retrieves one "${this.node}" if it exists, returns null otherwise`;

  @Memoize()
  public get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(this.node.uniqueFilterInputType),
      }),
    ];
  }

  @Memoize()
  public getGraphQLOutputType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<GetOneIfExistsQueryArgs>,
    path: utils.Path,
  ): Promise<GetOneIfExistsQueryResult> {
    const [nodeValue = null] = await this.node
      .getQueryByKey('find-many')
      .internal(
        context,
        authorization,
        {
          where: args.where,
          first: 1,
          selection: args.selection,
        },
        path,
      );

    return nodeValue;
  }
}
