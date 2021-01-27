import {
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import { OperationContext } from '../../../../../../operations';
import { NodeRecord } from '../../../../../node';
import { WhereInputValue } from '../../../../where';
import { AbstractAction } from './abstract';

export class DeleteManyReverseEdgeAction extends AbstractAction<
  NonNullable<WhereInputValue>
> {
  @Memoize()
  public get enabled() {
    return (
      !this.reverseEdge.unique &&
      this.reverseEdge.head.getOperation('delete').enabled
    );
  }

  @Memoize()
  public get public() {
    return this.enabled && this.reverseEdge.head.getOperation('delete').public;
  }

  public get graphqlInputFieldConfig() {
    return {
      description: `Delete the "${this.reverseEdge.head}" nodes connected by their "${this.reverseEdge.reverse.name}" edge`,
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

    if (value == null) {
      throw new UnexpectedValueError(value, `not to be "nullish"`, path);
    }

    return value;
  }

  public async handle(
    record: Readonly<NodeRecord>,
    value: NonNullable<WhereInputValue>,
    operationContext: OperationContext,
    path: Path,
  ) {
    const recordUniqueValue =
      this.reverseEdge.reverse.headReference.assertValue(record, path);

    await this.reverseEdge.head.api.deleteMany(
      {
        where: {},
        first: Number.MAX_SAFE_INTEGER,
        selection: this.reverseEdge.head.identifier.selection,
      },
      operationContext,
      path,
    );
  }
}
