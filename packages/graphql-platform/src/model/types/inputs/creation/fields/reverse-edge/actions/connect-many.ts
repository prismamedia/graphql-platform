import {
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { OperationContext } from '../../../../../../operations';
import { NodeRecord } from '../../../../../node';
import { WhereInputValue } from '../../../../where';
import { AbstractReverseEdgeAction } from './abstract';

export type ConnectManyReverseEdgeActionValue = Exclude<
  WhereInputValue,
  undefined | null | false
>;

export class ConnectManyReverseEdgeAction extends AbstractReverseEdgeAction<ConnectManyReverseEdgeActionValue> {
  @Memoize()
  public get enabled() {
    return (
      !this.reverseEdge.unique &&
      this.reverseEdge.head.getOperation('update').enabled &&
      this.reverseEdge.reverse.updateInput?.nullable === true
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
    return {
      description: `Connect "${this.reverseEdge.head}" nodes by their "${this.reverseEdge.reverse.name}" edge`,
      type: this.reverseEdge.head.whereInputType.type,
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

    const value = this.reverseEdge.head.whereInputType.assertValue(
      maybeValue,
      path,
    );

    if (value == null || value === false) {
      throw new UnexpectedValueError(
        value,
        `not to be "nullish" or "false"`,
        path,
      );
    }

    return value;
  }

  public async handle(
    record: Readonly<NodeRecord>,
    where: ConnectManyReverseEdgeActionValue,
    operationContext: OperationContext,
    path: Path,
  ) {
    await this.reverseEdge.head.api.updateMany<true>(
      {
        where,
        first: Number.MAX_SAFE_INTEGER,
        data: {
          [this.reverseEdge.reverse.name]: {
            connect: this.reverseEdge.reverse.headReference.assertValue(
              record,
              path,
            ),
          },
        },
        selection: this.reverseEdge.head.identifier.selection,
      },
      operationContext,
      path,
    );
  }
}
