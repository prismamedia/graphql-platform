import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import { AndOperation, NodeFilter } from '../../statement/filter.js';
import type { NodeSelectedValue } from '../../statement/selection/value.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';
import {
  catchConnectorOperationError,
  ConnectorOperationKind,
} from '../error.js';

export type FindManyQueryArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  skip?: utils.Nillable<number>;
  first: number;
}>;

export type FindManyQueryResult = NodeSelectedValue[];

export class FindManyQuery<
  TRequestContext extends object,
> extends AbstractQuery<
  TRequestContext,
  FindManyQueryArgs,
  FindManyQueryResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'find-many';
  public readonly name = inflection.camelize(this.node.plural, true);
  public readonly description = `Retrieves a list of "${this.node.plural}"`;

  @Memoize()
  public get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: this.node.filterInputType,
      }),
      new utils.Input({
        name: 'orderBy',
        type: new utils.ListableInputType(
          utils.nonNillableInputType(this.node.orderingInputType),
        ),
      }),
      new utils.Input({
        name: 'skip',
        type: scalars.typesByName.UnsignedInt,
      }),
      new utils.Input({
        name: 'first',
        type: utils.nonNillableInputType(scalars.typesByName.UnsignedInt),
      }),
    ];
  }

  public getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(
        new graphql.GraphQLNonNull(this.node.outputType.getGraphQLObjectType()),
      ),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<FindManyQueryArgs>,
    path: utils.Path,
  ): Promise<FindManyQueryResult> {
    if (args.first === 0) {
      return [];
    }

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
      return [];
    }

    const ordering = this.node.orderingInputType.sort(
      args.orderBy,
      context,
      utils.addPath(argsPath, 'orderBy'),
    ).normalized;

    return catchConnectorOperationError(
      () =>
        this.connector.find(context, {
          node: this.node,
          ...(filter && { filter }),
          ...(ordering && { ordering }),
          ...(args.skip && { offset: args.skip }),
          limit: args.first,
          selection: args.selection,
        }),
      this.node,
      ConnectorOperationKind.FIND,
      { path },
    );
  }
}
