import {
  addPath,
  ArrayOrValue,
  assertIterable,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import { OperationContext } from '../../../../../../operations';
import { NodeRecord } from '../../../../../node';
import { UpdateInputValue } from '../../../../update';
import { WhereUniqueInputValue } from '../../../../where-unique';
import { AbstractReverseEdgeAction } from './abstract';

export class ConnectReverseEdgeAction extends AbstractReverseEdgeAction<
  ArrayOrValue<WhereUniqueInputValue>
> {
  protected readonly ifExists: boolean = false;

  @Memoize()
  public get enabled() {
    return (
      this.reverseEdge.head.getOperation('update').enabled &&
      this.reverseEdge.reverse.updateInput !== undefined
    );
  }

  @Memoize()
  public get public() {
    return (
      this.enabled &&
      this.reverseEdge.head.getOperation('update').public &&
      this.reverseEdge.reverse.updateInput?.public === true
    );
  }

  public get graphqlInputFieldConfig() {
    return this.reverseEdge.unique
      ? {
          description: `Connect an existing "${
            this.reverseEdge.head
          }" node by its "${this.reverseEdge.reverse.name}" edge, ${
            this.ifExists ? 'if it exists' : 'throw an error if it is not found'
          }`,
          type: this.reverseEdge.head.whereUniqueInputType.type,
        }
      : {
          description: `Connect existing "${
            this.reverseEdge.head
          }" nodes by their "${this.reverseEdge.reverse.name}" edge, ${
            this.ifExists
              ? 'if they exist'
              : 'throw an error if one of them is not found'
          }`,
          type: GraphQLList(
            GraphQLNonNull(this.reverseEdge.head.whereUniqueInputType.type),
          ),
        };
  }

  public assertValue(maybeValue: unknown, path: Path) {
    if (!this.enabled) {
      throw new UnexpectedValueError(
        maybeValue,
        `not to be used as the "${this.reverseEdge}" does not support it`,
        path,
      );
    }

    if (this.reverseEdge.unique) {
      return this.reverseEdge.head.whereUniqueInputType.assertValue(
        maybeValue,
        path,
      );
    } else {
      assertIterable(maybeValue, path);

      return Array.from(maybeValue, (maybeWhereUniqueValue, index) =>
        this.reverseEdge.head.whereUniqueInputType.assertValue(
          maybeWhereUniqueValue,
          addPath(path, index),
        ),
      );
    }
  }

  public async handle(
    record: Readonly<NodeRecord>,
    value: ArrayOrValue<WhereUniqueInputValue>,
    operationContext: OperationContext,
    path: Path,
  ) {
    const data: UpdateInputValue = {
      [this.reverseEdge.reverse.name]: {
        connect: this.reverseEdge.reverse.headReference.assertValue(
          record,
          path,
        ),
      },
    };

    const selection = this.reverseEdge.head.identifier.selection;

    await Promise.all(
      (this.reverseEdge.unique
        ? [value as WhereUniqueInputValue]
        : (value as WhereUniqueInputValue[])
      ).map((where, index) =>
        this.ifExists
          ? this.reverseEdge.head.api.updateIfExists<true>(
              { where, data, selection },
              operationContext,
              addPath(path, index),
            )
          : this.reverseEdge.head.api.update<true>(
              { where, data, selection },
              operationContext,
              addPath(path, index),
            ),
      ),
    );
  }
}
