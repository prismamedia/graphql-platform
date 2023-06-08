import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import { AndOperation, NodeFilter } from '../../statement/filter.js';
import type { NodeFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';
import {
  catchConnectorOperationError,
  ConnectorOperationKind,
} from '../error.js';

export type CountQueryArgs = utils.Nillable<{
  where?: NodeFilterInputValue;
}>;

export type CountQueryResult = number;

export class CountQuery<TRequestContext extends object> extends AbstractQuery<
  TRequestContext,
  CountQueryArgs,
  CountQueryResult
> {
  protected readonly selectionAware = false;

  public readonly key = 'count';
  public readonly name = `${inflection.camelize(this.node.name, true)}Count`;
  public readonly description = `Gets the number of "${this.node.plural}"`;

  @Memoize()
  public get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
    ];
  }

  public getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(scalars.typesByName.UnsignedInt);
  }

  protected async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<CountQueryArgs>,
    path: utils.Path,
  ): Promise<CountQueryResult> {
    const argsPath = utils.addPath(path, argsPathKey);

    const filter = new NodeFilter(
      this.node,
      AndOperation.create([
        authorization?.filter,
        this.node.filterInputType.filter(
          args?.where,
          context,
          utils.addPath(argsPath, 'where'),
        ).filter,
      ]),
    ).normalized;

    if (filter?.isFalse()) {
      return 0;
    }

    return catchConnectorOperationError(
      () =>
        this.connector.count(context, {
          node: this.node,
          ...(filter && { filter }),
        }),
      this.node,
      ConnectorOperationKind.COUNT,
      { path },
    );
  }
}
