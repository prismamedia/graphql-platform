import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  Input,
  nonNillableInputType,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import { type NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeUniqueFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type ExistsQueryArgs = { where: NodeUniqueFilterInputValue };

export type ExistsQueryResult = boolean;

export class ExistsQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  ExistsQueryArgs,
  ExistsQueryResult
> {
  protected override readonly selectionAware = false;
  public override readonly name = `${inflection.camelize(
    this.node.name,
    true,
  )}Exists`;
  public override readonly description = `Either the "${this.node.name}" exists or not?`;

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
    return new graphql.GraphQLNonNull(Scalars.Boolean);
  }

  protected override async executeWithValidArgumentsAndContext(
    args: NodeSelectionAwareArgs<ExistsQueryArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<ExistsQueryResult> {
    const count = await this.node
      .getQueryByKey('count')
      .execute({ where: args.where }, context, path);

    return count > 0;
  }
}
