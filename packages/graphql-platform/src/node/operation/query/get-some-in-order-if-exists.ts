import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import {
  argsPathKey,
  NodeSelectionAwareArgs,
  RawNodeSelectionAwareArgs,
} from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import {
  doesSelectedValueMatchUniqueFilter,
  type NodeSelectedValue,
} from '../../statement/selection.js';
import type { NodeUniqueFilterInputValue } from '../../type.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';

export type GetSomeInOrderIfExistsQueryArgs = RawNodeSelectionAwareArgs<{
  where: ReadonlyArray<NonNullable<NodeUniqueFilterInputValue>>;
}>;

export type GetSomeInOrderIfExistsQueryResult = Array<NodeSelectedValue | null>;

export class GetSomeInOrderIfExistsQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  GetSomeInOrderIfExistsQueryArgs,
  GetSomeInOrderIfExistsQueryResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `${inflection.camelize(
    this.node.plural,
    true,
  )}InOrderIfExists`;
  public override readonly description = `Given a list of unique-filter's value, retrieves the corresponding "${this.node.plural}", or null, in the same order`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'where',
        type: utils.nonNillableInputType(
          new utils.ListableInputType(
            utils.nonNillableInputType(this.node.uniqueFilterInputType),
          ),
        ),
      }),
    ];
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(this.node.outputType.getGraphQLObjectType()),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    authorization: NodeFilter<TRequestContext, TConnector> | undefined,
    args: NodeSelectionAwareArgs<GetSomeInOrderIfExistsQueryArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: utils.Path,
  ): Promise<GetSomeInOrderIfExistsQueryResult> {
    const argsPath = utils.addPath(path, argsPathKey);
    const whereArgPath = utils.addPath(argsPath, 'where');

    const unorderedNodeValues = await this.node
      .getQueryByKey('find-many')
      .internal(
        authorization,
        {
          where: { OR: args.where },
          first: args.where.length,
          /**
           * We need to select the data provided in the "unique-filters" to discriminate the returned nodes, imagine the following use:
           *
           * someArticlesIfExists(where: [
           *  { id: "8c75f992-083e-4849-8020-4b3c156f484b" },
           *  { _id: 3 },
           *  { category: null, slug: "Welcome" },
           *  { _id: 6 },
           *  { category: { _id: 2 }, slug: "news" }
           * ]) {
           *   status
           * }
           *
           * We need the following selection: { id _id category { _id } slug status }
           */
          selection: args.where.reduce(
            (mergedSelection, filter, index) =>
              mergedSelection.mergeWith(
                this.node.outputType.selectShape(
                  filter,
                  context,
                  utils.addPath(whereArgPath, index),
                ),
                path,
              ),
            args.selection,
          ),
        },
        context,
        path,
      );

    return args.where.map((key) => {
      const maybeNodeValue = unorderedNodeValues.find((nodeValue) =>
        doesSelectedValueMatchUniqueFilter(this.node, nodeValue, key),
      );

      return maybeNodeValue ? args.selection.parseValue(maybeNodeValue) : null;
    });
  }
}
