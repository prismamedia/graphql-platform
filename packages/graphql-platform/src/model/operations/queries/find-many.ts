import { Scalars } from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  assertPlainObject,
  assertScalarValue,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import { camelize } from 'inflection';
import { ConnectorInterface } from '../../../connector';
import { OrderByInputValue } from '../../types/inputs/order-by';
import { WhereInputValue } from '../../types/inputs/where';
import { NodeValue } from '../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../abstract';
import { OperationContext } from '../context';
import { AbstractQuery } from './abstract';

export type FindManyOperationArgs = {
  where?: WhereInputValue;
  orderBy?: OrderByInputValue;
  skip?: number;
  first: number;
} & RawNodeSelectionAware;

export type FindManyOperationResult = NodeValue[];

export class FindManyOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractQuery<
  TRequestContext,
  TConnector,
  FindManyOperationArgs,
  FindManyOperationResult
> {
  public readonly name: string = camelize(this.model.plural, true);
  public readonly description = `Retrieves a list of "${this.model.name}" nodes`;

  public get graphqlFieldConfigArgs() {
    return {
      where: {
        type: this.model.whereInputType.type,
      },
      ...(this.model.orderByInputType.type && {
        orderBy: {
          type: this.model.orderByInputType.type,
        },
      }),
      skip: {
        type: Scalars.PositiveInt,
      },
      first: {
        type: GraphQLNonNull(Scalars.PositiveInt),
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(GraphQLList(GraphQLNonNull(this.model.nodeType.type)));
  }

  protected async doExecute(
    args: SelectionAware<FindManyOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<FindManyOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    const argsPath = addPath(path, 'args');

    const [filter, selection] = await Promise.all([
      this.model.getContextualizedFilter(
        args.where,
        operationContext,
        addPath(argsPath, 'where'),
      ),
      this.model.getContextualizedSelection(
        args.selection,
        operationContext,
        addPath(argsPath, 'selection'),
      ),
    ]);

    return filter.kind === 'Boolean' && !filter.value
      ? // In case of a "false" filter, we can save a connector call
        []
      : this.connector.find(
          this.model,
          {
            ...(!(filter.kind === 'Boolean' && filter.value) && {
              filter: filter,
            }),
            ...(args.orderBy && {
              sorts: this.model.orderByInputType.parseValue(
                args.orderBy,
                addPath(argsPath, 'orderBy'),
              ),
            }),
            ...(args.skip !== undefined && {
              skip: assertScalarValue(
                Scalars.PositiveInt,
                args.skip,
                addPath(argsPath, 'skip'),
              ),
            }),
            first: assertScalarValue(
              Scalars.PositiveInt,
              args.first,
              addPath(argsPath, 'first'),
            ),
            selection,
          },
          operationContext,
        );
  }
}
