import {
  addPath,
  aggregateError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import * as graphql from 'graphql';
import inflection from 'inflection';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { NodeSelectionAwareArgs } from '../../abstract-operation.js';
import type { NodeSelectedValue } from '../../statement/selection/value.js';
import { AbstractQuery } from '../abstract-query.js';
import type { OperationContext } from '../context.js';
import { NotFoundError } from '../error.js';
import type { GetSomeInOrderIfExistsQueryArgs } from './get-some-in-order-if-exists.js';

export type GetSomeInOrderQueryArgs = GetSomeInOrderIfExistsQueryArgs;

export type GetSomeInOrderQueryResult = NodeSelectedValue[];

export class GetSomeInOrderQuery<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
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
    return this.node.getQuery('get-some-in-order-if-exists').arguments;
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
    args: NodeSelectionAwareArgs<GetSomeInOrderQueryArgs>,
    context: OperationContext<TRequestContext, TConnector>,
    path: Path,
  ): Promise<GetSomeInOrderQueryResult> {
    const maybeNodeValues = await this.node
      .getQuery('get-some-in-order-if-exists')
      .execute(args, context, path);

    return aggregateError<NodeSelectedValue | null, GetSomeInOrderQueryResult>(
      maybeNodeValues,
      (nodeValues, maybeNodeValue, index) => {
        if (!maybeNodeValue) {
          throw new NotFoundError(this.node, args.where[index], {
            path: addPath(path, index),
          });
        }

        return [...nodeValues, maybeNodeValue];
      },
      [],
      { path },
    );
  }
}
