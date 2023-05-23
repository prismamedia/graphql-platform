import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeFilter } from '../../statement/filter.js';
import type { NodeSelectedValue } from '../../statement/selection/value.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';
import { NotFoundError } from '../error.js';
import type { GetSomeInOrderIfExistsQueryArgs } from './get-some-in-order-if-exists.js';

export type GetSomeInOrderQueryArgs = GetSomeInOrderIfExistsQueryArgs;

export type GetSomeInOrderQueryResult = NodeSelectedValue[];

export class GetSomeInOrderQuery<
  TRequestContext extends object,
> extends AbstractQuery<
  TRequestContext,
  GetSomeInOrderQueryArgs,
  GetSomeInOrderQueryResult
> {
  protected override readonly selectionAware = true;
  public override readonly name = `${inflection.camelize(
    this.node.plural,
    true,
  )}InOrder`;
  public override readonly description = `Given a list of unique-filter's value, retrieves the corresponding "${this.node.plural}" in the same order, throws an error if one does not exist`;

  @Memoize()
  public override get arguments() {
    return this.node.getQueryByKey('get-some-in-order-if-exists').arguments;
  }

  @Memoize()
  public override getGraphQLOutputType() {
    return new graphql.GraphQLNonNull(
      new graphql.GraphQLList(
        new graphql.GraphQLNonNull(this.node.outputType.getGraphQLObjectType()),
      ),
    );
  }

  protected override async executeWithValidArgumentsAndContext(
    context: OperationContext,
    authorization: NodeFilter | undefined,
    args: NodeSelectionAwareArgs<GetSomeInOrderQueryArgs>,
    path: utils.Path,
  ): Promise<GetSomeInOrderQueryResult> {
    const maybeNodeValues = await this.node
      .getQueryByKey('get-some-in-order-if-exists')
      .internal(context, authorization, args, path);

    return utils.aggregateGraphError<
      NodeSelectedValue | null,
      GetSomeInOrderQueryResult
    >(
      maybeNodeValues,
      (nodeValues, maybeNodeValue, index) => {
        if (!maybeNodeValue) {
          throw new NotFoundError(this.node, args.where[index], {
            path: utils.addPath(path, index),
          });
        }

        nodeValues.push(maybeNodeValue);

        return nodeValues;
      },
      [],
      { path },
    );
  }
}
