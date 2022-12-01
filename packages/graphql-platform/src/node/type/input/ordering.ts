import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/memoize';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import { Leaf } from '../../definition.js';
import { ReverseEdgeUnique } from '../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../operation/context.js';
import { NodeOrdering, OrderingDirection } from '../../statement/ordering.js';
import {
  OrderingExpressionInput,
  ReverseEdgeMultipleCountOrderingInput,
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
      ...this.node.components.flatMap<OrderingExpressionInput>((component) =>
        component instanceof Leaf && component.isSortable()
          ? [
              component.getOrderingInput(OrderingDirection.ASCENDING),
              component.getOrderingInput(OrderingDirection.DESCENDING),
            ]
          : [],
      ),
      ...this.node.reverseEdges.flatMap<OrderingExpressionInput>(
        (reverseEdge) =>
          reverseEdge instanceof ReverseEdgeUnique
            ? []
            : [
                new ReverseEdgeMultipleCountOrderingInput(
                  reverseEdge,
                  OrderingDirection.ASCENDING,
                ),
                new ReverseEdgeMultipleCountOrderingInput(
                  reverseEdge,
                  OrderingDirection.DESCENDING,
                ),
              ],
      ),
    ];
  }

  public sort<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
  >(
    value: OrderByInputValue,
    context?: OperationContext<TRequestContext, TConnector>,
    path: utils.Path = utils.addPath(undefined, this.name),
  ): NodeOrdering<TRequestContext, TConnector> {
    return new NodeOrdering(
      this.node,
      value?.length
        ? value.map((value, index) =>
            this.getEnumValue(value, utils.addPath(path, index)).sort(
              context,
              utils.addPath(path, value),
            ),
          )
        : [],
    );
  }
}
