import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { Node } from '../../../../../node.js';
import { Leaf } from '../../../../definition.js';
import { OrderingDirection } from '../../../../statement/ordering/direction.js';
import type { LeafOrderingInput } from '../../../../type/input/ordering/expression/leaf.js';

export type ScrollCursorOrderingInputValue = utils.Nillable<
  LeafOrderingInput['value']
>;

export class ScrollCursorOrderingInputType extends utils.EnumInputType<LeafOrderingInput> {
  public constructor(public readonly node: Node) {
    assert(
      node.uniqueConstraintSet
        .values()
        .some((uniqueConstraint) => uniqueConstraint.isScrollable()),
    );

    super({
      name: `${node}ScrollCursorOrderingInput`,
      description: `Order the "${node}"'s scroll`,
    });
  }

  @MGetter
  public override get enumValues(): ReadonlyArray<LeafOrderingInput> {
    return this.node.uniqueConstraintSet
      .values()
      .filter((uniqueConstraint) => uniqueConstraint.isScrollable())
      .flatMap((uniqueConstraint) =>
        uniqueConstraint.componentSet.values().flatMap((component) => {
          assert(component instanceof Leaf);

          return [
            component.getOrderingInput(OrderingDirection.ASCENDING),
            component.getOrderingInput(OrderingDirection.DESCENDING),
          ];
        }),
      )
      .toArray();
  }
}
