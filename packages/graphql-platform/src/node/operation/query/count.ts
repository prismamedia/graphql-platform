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
import { ConnectorError } from '../error.js';

export type CountQueryArgs = utils.Nillable<{
  where?: NodeFilterInputValue;
}>;

export type CountQueryResult = number;

export class CountQuery<TRequestContext extends object> extends AbstractQuery<
  TRequestContext,
  CountQueryArgs,
  CountQueryResult
> {
  protected override readonly selectionAware = false;
  public override readonly name = `${inflection.camelize(
    this.node.name,
    true,
  )}Count`;
  public override readonly description = `Gets the number of "${this.node.plural}"`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(scalars.typesByName.UnsignedInt);
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<CountQueryArgs>,
    context: OperationContext,
    path: utils.Path,
  ): Promise<CountQueryResult> {
    const argsPath = utils.addPath(path, argsPathKey);

    const filter = new NodeFilter(
      this.node,
      new AndOperation([
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

    try {
      return await this.connector.count(
        {
          node: this.node,
          ...(filter && { filter }),
        },
        context,
      );
    } catch (error) {
      throw new ConnectorError({ cause: error, path });
    }
  }
}
