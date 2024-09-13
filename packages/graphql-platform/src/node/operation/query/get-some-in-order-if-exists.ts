import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { BrokerInterface } from '../../../broker-interface.js';
import type { ConnectorInterface } from '../../../connector-interface.js';
import {
  argsPathKey,
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

export type GetSomeInOrderIfExistsQueryArgs = RawNodeSelectionAwareArgs<{
  where: ReadonlyArray<NonNullable<NodeUniqueFilterInputValue>>;
  subset?: NodeFilterInputValue;
}>;

export type GetSomeInOrderIfExistsQueryResult = Array<NodeSelectedValue | null>;

export class GetSomeInOrderIfExistsQuery<
  TRequestContext extends object,
> extends AbstractQuery<
  TRequestContext,
  ConnectorInterface,
  BrokerInterface,
  object,
  GetSomeInOrderIfExistsQueryArgs,
  GetSomeInOrderIfExistsQueryResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'get-some-in-order-if-exists';
  public readonly name = `${inflection.camelize(
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
      new utils.Input({
        name: 'subset',
        description:
          'It is possible to provide a filter in order to perform this operation in a subset of the documents',
        type: this.node.filterInputType,
      }),
    ];
  }

  public getGraphQLFieldConfigType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(this.node.outputType.getGraphQLObjectType()),
    );
  }

  protected async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<GetSomeInOrderIfExistsQueryArgs>,
    path: utils.Path,
  ): Promise<GetSomeInOrderIfExistsQueryResult> {
    const argsPath = utils.addPath(path, argsPathKey);
    const whereArgPath = utils.addPath(argsPath, 'where');

    const unorderedValues = await this.node.getQueryByKey('find-many').internal(
      context,
      authorization,
      {
        where: { AND: [{ OR: args.where }, args.subset] },
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
      path,
    );

    return args.where.map((id) => {
      const filter = this.node.filterInputType.filter(id);
      const maybeValue = unorderedValues.find((value) =>
        filter.execute(value, false),
      );

      return maybeValue ? args.selection.pickValue(maybeValue) : null;
    });
  }
}
