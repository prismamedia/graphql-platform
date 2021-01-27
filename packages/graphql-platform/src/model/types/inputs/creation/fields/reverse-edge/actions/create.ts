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
import { CreationInputValue } from '../../../../creation';
import { AbstractReverseEdgeAction } from './abstract';

export class CreateReverseEdgeAction extends AbstractReverseEdgeAction<
  ArrayOrValue<CreationInputValue>
> {
  @Memoize()
  public get enabled() {
    return (
      this.reverseEdge.head.getOperation('create').enabled &&
      this.reverseEdge.reverse.createInput !== undefined
    );
  }

  @Memoize()
  public get public() {
    return (
      this.enabled &&
      this.reverseEdge.head.getOperation('create').public &&
      this.reverseEdge.reverse.createInput?.public === true &&
      this.reverseEdge.head.creationInputType.hasTypeWithoutEdge(
        this.reverseEdge.reverse,
      )
    );
  }

  public get graphqlInputFieldConfig() {
    return this.reverseEdge.unique
      ? {
          description: `Create a new "${this.reverseEdge.head}" node and connect it by its "${this.reverseEdge.reverse.name}" edge`,
          type: this.reverseEdge.head.creationInputType.getTypeWithoutEdge(
            this.reverseEdge.reverse,
          ),
        }
      : {
          description: `Create new "${this.reverseEdge.head}" nodes and connect them by their "${this.reverseEdge.reverse.name}" edge`,
          type: GraphQLList(
            GraphQLNonNull(
              this.reverseEdge.head.creationInputType.getTypeWithoutEdge(
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
      return this.reverseEdge.head.creationInputType.assertValueWithoutEdge(
        this.reverseEdge.reverse,
        maybeValue,
        path,
      );
    } else {
      assertIterable(maybeValue, path);

      return Array.from(maybeValue, (maybeData, index) =>
        this.reverseEdge.head.creationInputType.assertValueWithoutEdge(
          this.reverseEdge.reverse,
          maybeData,
          addPath(path, index),
        ),
      );
    }
  }

  public async handle(
    record: Readonly<NodeRecord>,
    value: ArrayOrValue<CreationInputValue>,
    operationContext: OperationContext,
    path: Path,
  ) {
    const recordReference = {
      [this.reverseEdge.reverse.name]: {
        connect: this.reverseEdge.reverse.headReference.assertValue(
          record,
          path,
        ),
      },
    };

    const selection = this.reverseEdge.head.identifier.selection;

    await this.reverseEdge.head.api.createMany(
      {
        data: this.reverseEdge.unique
          ? [value as CreationInputValue]
          : (value as CreationInputValue[]).map((data) => ({
              ...recordReference,
              ...data,
            })),
        selection,
      },
      operationContext,
      path,
    );
  }
}
