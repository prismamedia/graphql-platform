import Scalars from '@prismamedia/graphql-platform-scalars';
import {
  addPath,
  assertPlainObject,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import { ConnectorInterface } from '../../../../connector';
import { OrderByInputValue } from '../../../types/inputs/order-by';
import { WhereInputValue } from '../../../types/inputs/where';
import { NodeValue } from '../../../types/node';
import { RawNodeSelectionAware, SelectionAware } from '../../abstract';
import { OperationContext } from '../../context';
import { AbstractMutation } from '../abstract';

export type DeleteManyOperationArgs = {
  where?: WhereInputValue;
  orderBy?: OrderByInputValue;
  first: number;
} & RawNodeSelectionAware;

export type DeleteManyOperationResult = NodeValue[];

export class DeleteManyOperation<
  TRequestContext,
  TConnector extends ConnectorInterface,
> extends AbstractMutation<
  TRequestContext,
  TConnector,
  DeleteManyOperationArgs,
  DeleteManyOperationResult
> {
  public readonly name = `delete${this.model.plural}`;
  public readonly description = `Deletes many "${this.model.name}" nodes then returns them`;

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
      first: {
        type: GraphQLNonNull(Scalars.PositiveInt),
      },
    };
  }

  public get graphqlFieldConfigType() {
    return GraphQLNonNull(GraphQLList(GraphQLNonNull(this.model.nodeType.type)));
  }

  protected async doExecute(
    args: SelectionAware<DeleteManyOperationArgs>,
    operationContext: OperationContext,
    path: Path,
  ): Promise<DeleteManyOperationResult> {
    assertPlainObject(args, path, 'some arguments');

    const argsPath = addPath(path, 'args');

    return [];
  }
}
