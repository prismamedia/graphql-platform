import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import { NodeFilter } from '../../statement.js';
import type { NodeFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';
import { catchConnectorOperationError } from '../error.js';

export type CountQueryArgs = utils.Nillable<{
  where?: NodeFilterInputValue;
}>;

export type CountQueryResult = number;

export class CountQuery<TRequestContext extends object> extends AbstractQuery<
  CountQueryArgs,
  CountQueryResult,
  TRequestContext,
  ConnectorInterface
> {
  protected readonly selectionAware = false;

  public readonly key = 'count';
  public readonly name = `${inflection.camelize(this.node.name, true)}Count`;
  public override readonly description = `Gets the number of "${this.node.plural}"`;

  @MGetter
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
    ];
  }

  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(scalars.typesByName.UnsignedInt);
  }

  protected async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<CountQueryArgs>,
    path: utils.Path,
  ): Promise<CountQueryResult> {
    const argsPath = utils.addPath(path, argsPathKey);

    const where = this.node.filterInputType.filter(
      args?.where,
      context,
      utils.addPath(argsPath, 'where'),
    ).normalized;

    const filter = (
      authorization && where ? authorization.and(where) : authorization || where
    )?.normalized;

    if (filter?.isFalse()) {
      return 0;
    }

    return catchConnectorOperationError(
      () =>
        this.connector.count(
          context,
          {
            node: this.node,
            ...(filter && { filter }),
          },
          path,
        ),
      context.request,
      this.node,
      { path },
    );
  }
}
