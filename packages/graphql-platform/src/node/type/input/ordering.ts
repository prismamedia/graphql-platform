import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { Node } from '../../../node.js';
import { Leaf } from '../../definition.js';
import type { OperationContext } from '../../operation/context.js';
import { NodeOrdering, OrderingDirection } from '../../statement/ordering.js';
import {
  MultipleReverseEdgeCountOrderingInput,
  OrderingExpressionInput,
} from './ordering/expression.js';

export * from './ordering/expression.js';

export type NodeOrderingInputValue = utils.Nillable<
  OrderingExpressionInput['value']
>;

export type OrderByInputValue =
  | NonNullable<NodeOrderingInputValue>[]
  | utils.Nil;

export class NodeOrderingInputType extends utils.EnumInputType<OrderingExpressionInput> {
  public constructor(public readonly node: Node) {
    super({
      name: `${node}OrderingInput`,
      description: `Order the "${node}" nodes`,
    });
  }

  @Memoize()
  public override get enumValues(): ReadonlyArray<OrderingExpressionInput> {
    return [
      ...Array.from(this.node.componentSet).flatMap<OrderingExpressionInput>(
        (component) =>
          component instanceof Leaf && component.isSortable()
            ? [
                component.getOrderingInput(OrderingDirection.ASCENDING),
                component.getOrderingInput(OrderingDirection.DESCENDING),
              ]
            : [],
      ),
      ...Array.from(
        this.node.multipleReverseEdgeSet,
      ).flatMap<OrderingExpressionInput>((reverseEdge) => [
        new MultipleReverseEdgeCountOrderingInput(
          reverseEdge,
          OrderingDirection.ASCENDING,
        ),
        new MultipleReverseEdgeCountOrderingInput(
          reverseEdge,
          OrderingDirection.DESCENDING,
        ),
      ]),
    ];
  }

  public sort(
    value: OrderByInputValue,
    context?: OperationContext,
    path?: utils.Path,
  ): NodeOrdering {
    utils.assertNillableIterableObject<NodeOrderingInputValue>(value, path);

    return new NodeOrdering(
      this.node,
      value
        ? Array.from(value, (value, index) =>
            this.getEnumValue(value, utils.addPath(path, index)).sort(
              context,
              utils.addPath(path, value),
            ),
          )
        : [],
    );
  }
}
