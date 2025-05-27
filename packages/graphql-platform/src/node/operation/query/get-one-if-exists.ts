import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import inflection from 'inflection';
import type {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeFilter, NodeSelectedValue } from '../../statement.js';
import type {
  NodeFilterInputValue,
  NodeUniqueFilterInputValue,
} from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type GetOneIfExistsQueryArgs = RawNodeSelectionAwareArgs<{
  where: NonNullable<NodeUniqueFilterInputValue>;
  subset?: NodeFilterInputValue;
}>;

export type GetOneIfExistsQueryResult = NodeSelectedValue | null;

export class GetOneIfExistsQuery<
  TRequestContext extends object,
> extends AbstractQuery<
  GetOneIfExistsQueryArgs,
  GetOneIfExistsQueryResult,
  TRequestContext
> {
  protected readonly selectionAware = true;

  public readonly key = 'get-one-if-exists';
  public readonly name = `${inflection.camelize(this.node.name, true)}IfExists`;
  public override readonly description = `Retrieves one "${this.node}" if it exists, returns null otherwise`;

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
          where: { AND: [args.where, args.subset] },
          first: 1,
          selection: args.selection,
        },
        path,
      );

    return nodeValue;
  }
}
