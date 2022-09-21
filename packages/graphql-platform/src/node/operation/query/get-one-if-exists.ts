import {
  Input,
  nonNillableInputType,
  type NonNillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import {
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeSelectedValue } from '../../statement/selection/value.js';
import type { NodeUniqueFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type GetOneIfExistsQueryArgs = RawNodeSelectionAwareArgs<{
  where: NonNillable<NodeUniqueFilterInputValue>;
}>;

export type GetOneIfExistsQueryResult = NodeSelectedValue | null;

export class GetOneIfExistsQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  GetOneIfExistsQueryArgs,
  GetOneIfExistsQueryResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `${inflection.camelize(
    this.node.name,
    true,
  )}IfExists`;
  public override readonly description = `Retrieves one "${this.node.name}" if it exists, returns null otherwise`;

  @Memoize()
  public override get arguments() {
    return [
      new Input({
        name: 'where',
        type: nonNillableInputType(this.node.uniqueFilterInputType),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return this.node.outputType.getGraphQLObjectType();
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<GetOneIfExistsQueryArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<GetOneIfExistsQueryResult> {
    const [nodeValue = null] = await this.node
      .getQueryByKey('find-many')
      .execute(
        {
          where: args.where,
          first: 1,
          selection: args.selection,
        },
        context,
        path,
      );

    return nodeValue;
  }
}
