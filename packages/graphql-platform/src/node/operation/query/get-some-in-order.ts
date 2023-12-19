import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeFilter, NodeSelectedValue } from '../../statement.js';
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
  protected readonly selectionAware = true;

  public readonly key = 'get-some-in-order';
  public readonly name = `${inflection.camelize(
    this.node.plural,
    true,
  )}InOrder`;
  public readonly description = `Given a list of unique-filter's value, retrieves the corresponding "${this.node.plural}" in the same order, throws an error if one does not exist`;

  public get arguments() {
    return this.node.getQueryByKey('get-some-in-order-if-exists').arguments;
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
    args: NodeSelectionAwareArgs<GetSomeInOrderQueryArgs>,
    path: utils.Path,
  ): Promise<GetSomeInOrderQueryResult> {
    const maybeValues = await this.node
      .getQueryByKey('get-some-in-order-if-exists')
      .internal(context, authorization, args, path);

    return utils.aggregateGraphError<
      NodeSelectedValue | null,
      GetSomeInOrderQueryResult
    >(
      maybeValues,
      (values, maybeValue, index) => {
        if (!maybeValue) {
          throw new NotFoundError(this.node, args.where[index], {
            path: utils.addPath(path, index),
          });
        }

        values.push(maybeValue);

        return values;
      },
      [],
      { path },
    );
  }
}
