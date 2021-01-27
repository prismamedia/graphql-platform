import {
  addPath,
  assertIterable,
  Path,
  PlainObject,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { GraphQLBoolean, GraphQLList, GraphQLNonNull } from 'graphql';
import { OperationContext } from '../../../../../../operations';
import { NodeRecord } from '../../../../../node';
import { UpdateInputValue } from '../../../../update';
import { WhereUniqueInputValue } from '../../../../where-unique';
import { AbstractAction } from './abstract';

export class DisconnectReverseEdgeAction extends AbstractAction<
  boolean | WhereUniqueInputValue[]
> {
  protected readonly ifExists: boolean = false;

  @Memoize()
  public get enabled() {
    return (
      this.reverseEdge.head.getOperation('update').enabled &&
      this.reverseEdge.reverse.updateInput?.nullable === true &&
      this.reverseEdge.head.whereUniqueInputType.hasUniqueConstraintWithEdge(
        this.reverseEdge.reverse,
      )
    );
  }

  @Memoize()
  public get public() {
    return (
      this.enabled &&
      this.reverseEdge.head.getOperation('update').public &&
      this.reverseEdge.reverse.updateInput?.public === true &&
      this.reverseEdge.head.whereUniqueInputType.hasPublicUniqueConstraintWithEdge(
        this.reverseEdge.reverse,
      )
    );
  }

  public get graphqlInputFieldConfig() {
    return this.reverseEdge.unique
      ? {
          description: `Disconnect the "${
            this.reverseEdge.head
          }" node connected by its "${this.reverseEdge.reverse.name}" edge, ${
            this.ifExists ? 'if any' : 'throw an error if none is connected'
          }`,
          type: GraphQLBoolean,
        }
      : {
          description: `Disconnect the "${
            this.reverseEdge.head
          }" nodes connected by their "${
            this.reverseEdge.reverse.name
          }" edge, ${
            this.ifExists
              ? 'if they are connected'
              : 'throw an error if one of them is not connected'
          }`,
          type: GraphQLList(
            GraphQLNonNull(
              this.reverseEdge.head.whereUniqueInputType.getTypeWithoutEdge(
                this.reverseEdge.reverse,
              ),
            ),
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
      if (typeof maybeValue !== 'boolean') {
        throw new UnexpectedValueError(maybeValue, 'a boolean', path);
      }

      return maybeValue;
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
    value: boolean | WhereUniqueInputValue[],
    operationContext: OperationContext,
    path: Path,
  ) {
    const recordReference = {
      [this.reverseEdge.reverse.name]:
        this.reverseEdge.reverse.headReference.assertValue(record, path),
    };

    const data: UpdateInputValue = { [this.reverseEdge.reverse.name]: null };

    const selection = this.reverseEdge.head.identifier.selection;

    await Promise.all(
      (this.reverseEdge.unique
        ? [{} as PlainObject]
        : (value as PlainObject[])
      ).map((where, index) =>
        this.reverseEdge.head.api.update(
          {
            where: {
              ...recordReference,
              ...where,
            },
            data,
            selection,
          },
          operationContext,
          addPath(path, index),
        ),
      ),
    );
  }
}
