import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
  type RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import { NodeFilter, type NodeSelectedValue } from '../../statement.js';
import type { NodeFilterInputValue, OrderByInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';
import {
  catchConnectorOperationError,
  ConnectorOperationKind,
} from '../error.js';
import {
  ChangesSubscriptionCacheControlInputType,
  type ChangesSubscriptionCacheControlInputValue,
} from '../subscription/changes/cache-control.js';

export type FindManyQueryArgs = RawNodeSelectionAwareArgs<{
  where?: NodeFilterInputValue;
  orderBy?: OrderByInputValue;
  skip?: utils.Nillable<number>;
  first: number;
  forSubscription?: ChangesSubscriptionCacheControlInputValue;
}>;

export type FindManyQueryResult = NodeSelectedValue[];

export class FindManyQuery<
  TRequestContext extends object,
> extends AbstractQuery<
  FindManyQueryArgs,
  FindManyQueryResult,
  TRequestContext,
  ConnectorInterface
> {
  protected readonly selectionAware = true;

  public readonly key = 'find-many';
  public readonly name = inflection.camelize(this.node.plural, true);
  public override readonly description = `Retrieves a list of "${this.node.plural}"`;

  @MGetter
  public override get arguments() {
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
      new utils.Input({
        public: false,
        name: 'forSubscription',
        type: ChangesSubscriptionCacheControlInputType,
      }),
    ];
  }

  public getGraphQLFieldConfigType() {
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
    if (!args.first) {
      return [];
    }

    const argsPath = utils.addPath(path, argsPathKey);

    const where = this.node.filterInputType.filter(
      args.where,
      context,
      utils.addPath(argsPath, 'where'),
    ).normalized;

    const filter = (
      authorization && where ? authorization.and(where) : authorization || where
    )?.normalized;

    if (filter?.isFalse()) {
      return [];
    }

    const ordering = this.node.orderingInputType.sort(
      args.orderBy,
      context,
      utils.addPath(argsPath, 'orderBy'),
    ).normalized;

    const rawSources = await catchConnectorOperationError(
      () =>
        this.connector.find(
          context,
          {
            node: this.node,
            ...(filter && { filter }),
            ...(ordering && { ordering }),
            ...(args.skip && { offset: args.skip }),
            limit: args.first,
            selection: args.selection,
            ...(args.forSubscription && {
              forSubscription: args.forSubscription,
            }),
          },
          path,
        ),
      context.request,
      this.node,
      ConnectorOperationKind.FIND,
      { path },
    );

    return Promise.all(
      rawSources.map((rawSource) =>
        args.selection.resolveValue(
          args.selection.parseSource(rawSource, path),
          context,
          path,
        ),
      ),
    );
  }
}
