import * as utils from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import { ReverseEdgeUnique } from '../../definition/reverse-edge/unique.js';
import type { OperationContext } from '../../operation/context.js';
import { NodeOrdering, OrderingDirection } from '../../statement/ordering.js';
import {
  LeafOrderingInputType,
  OrderingExpressionInputType,
  ReverseEdgeMultipleCountOrderingInputType,
} from './ordering/expression.js';

export * from './ordering/expression.js';

export type NodeOrderingInputValue = utils.Nillable<
  OrderingExpressionInputType['value']
>;

export type OrderByInputValue =
  | NonNullable<NodeOrderingInputValue>[]
  | utils.Nil;

export class NodeOrderingInputType extends utils.EnumInputType<OrderingExpressionInputType> {
  public constructor(public readonly node: Node) {
    super({
      name: `${node}OrderingInput`,
      description: `Order the "${node}" nodes`,
    });
  }

  @Memoize()
  public override get enumValues(): ReadonlyArray<OrderingExpressionInputType> {
    return [
      ...this.node.leaves.flatMap<OrderingExpressionInputType>((leaf) =>
        leaf.isSortable()
          ? [
              new LeafOrderingInputType(leaf, OrderingDirection.ASCENDING),
              new LeafOrderingInputType(leaf, OrderingDirection.DESCENDING),
            ]
          : [],
      ),
      ...this.node.reverseEdges.flatMap<OrderingExpressionInputType>(
        (reverseEdge) =>
          reverseEdge instanceof ReverseEdgeUnique
            ? []
            : [
                new ReverseEdgeMultipleCountOrderingInputType(
                  reverseEdge,
                  OrderingDirection.ASCENDING,
                ),
                new ReverseEdgeMultipleCountOrderingInputType(
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
