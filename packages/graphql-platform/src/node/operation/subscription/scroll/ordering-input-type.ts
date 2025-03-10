import * as utils from '@prismamedia/graphql-platform-utils';
import { MGetter } from '@prismamedia/memoize';
import assert from 'node:assert';
import type { Node } from '../../../../node.js';
import { Leaf } from '../../../definition.js';
import { OrderingDirection } from '../../../statement/ordering/direction.js';
import type { LeafOrderingInput } from '../../../type/input/ordering/expression/leaf.js';

export type ScrollSubscriptionOrderingInputValue = utils.Nillable<
  LeafOrderingInput['value']
>;

export class ScrollSubscriptionOrderingInputType extends utils.EnumInputType<LeafOrderingInput> {
  public constructor(public readonly node: Node) {
    assert(
      node.uniqueConstraintSet
        .values()
        .some((uniqueConstraint) => uniqueConstraint.isScrollable()),
    );

    super({
      name: `${node}ScrollOrderingInput`,
      description: `Order the "${node}"'s scroll`,
    });
  }

  @MGetter
  public override get enumValues(): ReadonlyArray<LeafOrderingInput> {
    return this.node.uniqueConstraintSet
      .values()
      .flatMap<LeafOrderingInput>((uniqueConstraint) =>
        uniqueConstraint.isScrollable()
          ? uniqueConstraint.componentSet
              .values()
              .flatMap((component) =>
                component instanceof Leaf && component.isSortable()
                  ? [
                      component.getOrderingInput(OrderingDirection.ASCENDING),
                      component.getOrderingInput(OrderingDirection.DESCENDING),
                    ]
                  : [],
              )
          : [],
      )
      .toArray();
  }
}
