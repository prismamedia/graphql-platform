import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { LeafOrdering, Node } from '../../../../node.js';
import { OrderingDirection } from '../../../statement.js';
import { LeafFilterInput } from '../../../type.js';
import type { OperationContext } from '../../context.js';
import {
  ScrollCursorOrderingInputType,
  type ScrollCursorOrderingInputValue,
} from './cursor/ordering.js';

export * from './cursor/ordering.js';

export type ScrollCursorInputValue = {
  orderBy?: ScrollCursorOrderingInputValue;
  size?: number;
};

export class ScrollCursor {
  public constructor(
    public readonly ordering: LeafOrdering,
    public readonly nextFilterInput: LeafFilterInput,
    public readonly size: number,
  ) {}
}

export class ScrollCursorInputType extends utils.ObjectInputType {
  public constructor(public readonly node: Node) {
    super({
      name: `${node}ScrollCursorInput`,
      fields: () => {
        const firstOrderingInputValue = this.orderingInputType.enumValues[0];

        return [
          new utils.Input({
            name: 'orderBy',
            type: utils.nonNillableInputType(this.orderingInputType),
            defaultValue: firstOrderingInputValue.isPublic()
              ? firstOrderingInputValue.value
              : () => firstOrderingInputValue.value,
          }),
          new utils.Input({
            name: 'size',
            type: utils.nonNillableInputType(scalars.GraphQLUnsignedInt),
            defaultValue: 100,
          }),
        ];
      },
    });
  }

  @MGetter
  public get orderingInputType() {
    return new ScrollCursorOrderingInputType(this.node);
  }

  public createCursor(
    context: OperationContext | undefined,
    inputValue: Required<ScrollCursorInputValue>,
    path?: utils.Path,
  ): ScrollCursor {
    const ordering = this.orderingInputType
      .getEnumValue(inputValue.orderBy, utils.addPath(path, 'orderBy'))
      .sort(context, utils.addPath(path, 'orderBy'));

    const nextFilterInput = this.node.filterInputType.fields.find(
      (field): field is LeafFilterInput =>
        field instanceof LeafFilterInput &&
        field.leaf === ordering.leaf &&
        field.id ===
          (ordering.direction === OrderingDirection.ASCENDING ? 'gt' : 'lt'),
    );

    assert(nextFilterInput, 'There is no leaf-filter input corresponding');

    return new ScrollCursor(ordering, nextFilterInput, inputValue.size);
  }
}
