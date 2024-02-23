import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { Node } from '../../../node.js';
import { Leaf } from '../../definition.js';
import type { OperationContext } from '../../operation/context.js';
import { NodeOrdering, OrderingDirection } from '../../statement/ordering.js';
import { OrderingExpressionInput } from './ordering/expression.js';

export * from './ordering/expression.js';

export type NodeOrderingInputValue = utils.Nillable<
  OrderingExpressionInput['value']
>;

export type OrderByInputValue = utils.Nillable<
  NonNullable<NodeOrderingInputValue>[]
>;

export type NodeOrderingInputTypeOverride = {
  name?: string;
  description?: string;
};

export class NodeOrderingInputType extends utils.EnumInputType<OrderingExpressionInput> {
  public constructor(
    public readonly node: Node,
    override?: Partial<NodeOrderingInputTypeOverride>,
  ) {
    super({
      name: override?.name ?? `${node}OrderingInput`,
      description: override?.description ?? `Order the "${node}" nodes`,
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
        reverseEdge.getOrderingInput(OrderingDirection.ASCENDING),
        reverseEdge.getOrderingInput(OrderingDirection.DESCENDING),
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
