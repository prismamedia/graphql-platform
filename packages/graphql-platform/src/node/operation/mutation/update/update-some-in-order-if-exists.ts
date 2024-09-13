import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { BrokerInterface } from '../../../../broker-interface.js';
import type { ConnectorInterface } from '../../../../connector-interface.js';
import {
  argsPathKey,
  type NodeSelectionAwareArgs,
} from '../../../abstract-operation.js';
import type { NodeFilter } from '../../../statement.js';
import type { NodeUpdateInputValue } from '../../../type.js';
import type {
  GetSomeInOrderIfExistsQueryArgs,
  GetSomeInOrderIfExistsQueryResult,
} from '../../query.js';
import { AbstractUpdate } from '../abstract-update.js';
import type { MutationContext } from '../context.js';

export type UpdateSomeInOrderIfExistsMutationArgs = {
  data?: NodeUpdateInputValue;
} & GetSomeInOrderIfExistsQueryArgs;

export type UpdateSomeInOrderIfExistsMutationResult =
  GetSomeInOrderIfExistsQueryResult;

export class UpdateSomeInOrderIfExistsMutation<
  TRequestContext extends object,
> extends AbstractUpdate<
  TRequestContext,
  ConnectorInterface,
  BrokerInterface,
  object,
  UpdateSomeInOrderIfExistsMutationArgs,
  UpdateSomeInOrderIfExistsMutationResult
> {
  protected readonly selectionAware = true;

  public readonly key = 'update-some-in-order-if-exists';
  public readonly name = `updateSome${this.node.plural}InOrderIfExists`;
  public override readonly description = `Given a list of unique-filter's value, updates the corresponding "${this.node.plural}" then returns their new values, or null, in the same order`;

  @Memoize()
  public override get arguments() {
    return [
      new utils.Input({
        name: 'data',
        type: this.node.updateInputType,
      }),
      ...this.node.getQueryByKey('get-some-in-order-if-exists').arguments,
    ];
  }

  public getGraphQLFieldConfigType() {
    return this.node
      .getQueryByKey('get-some-in-order-if-exists')
      .getGraphQLFieldConfigType();
  }

  protected async executeWithValidArgumentsAndContext(
    context: MutationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<UpdateSomeInOrderIfExistsMutationArgs>,
    path: utils.Path,
  ): Promise<UpdateSomeInOrderIfExistsMutationResult> {
    const argsPath = utils.addPath(path, argsPathKey);
    const whereArgPath = utils.addPath(argsPath, 'where');

    const unorderedValues = await this.node
      .getMutationByKey('update-many')
      .internal(
        context,
        authorization,
        {
          data: args.data,
          where: { AND: [{ OR: args.where }, args.subset] },
          first: args.where.length,
          /**
           * We need to select the data provided in the "unique-filters" to discriminate the returned nodes, imagine the following use:
           *
           * updateSomeArticlesIfExists(where: [
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
