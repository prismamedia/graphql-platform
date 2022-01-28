import {
  addPath,
  aggregateError,
  EnumInputType,
  type Nil,
  type Nillable,
  type NonNillable,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import type { ConnectorInterface } from '../../../connector-interface.js';
import type { Node } from '../../../node.js';
import type { OperationContext } from '../../operation/context.js';
import {
  NodeOrdering,
  OrderingDirection,
  OrderingExpression,
} from '../../statement/ordering.js';
import {
  LeafOrderingInputType,
  OrderingExpressionInputType,
  ReverseEdgeMultipleCountOrderingInputType,
} from './ordering/expression.js';

export * from './ordering/expression.js';

export type NodeOrderingInputValue = Nillable<
  OrderingExpressionInputType['value']
>;

export type OrderByInputValue = NonNillable<NodeOrderingInputValue>[] | Nil;

export class NodeOrderingInputType extends EnumInputType<OrderingExpressionInputType> {
  public constructor(public readonly node: Node) {
    super({
      name: `${node.name}OrderingInput`,
      description: `Order the "${node.name}" nodes`,
    });
  }

  @Memoize()
  public override get enumValues(): ReadonlyArray<OrderingExpressionInputType> {
    return Object.freeze([
      ...Array.from(
        this.node.leavesByName.values(),
      ).flatMap<OrderingExpressionInputType>((leaf) =>
        leaf.sortable
          ? [
              new LeafOrderingInputType(leaf, OrderingDirection.ASCENDING),
              new LeafOrderingInputType(leaf, OrderingDirection.DESCENDING),
            ]
          : [],
      ),
      ...Array.from(
        this.node.reverseEdgesByName.values(),
      ).flatMap<OrderingExpressionInputType>((reverseEdge) =>
        reverseEdge.kind === 'Multiple'
          ? [
              new ReverseEdgeMultipleCountOrderingInputType(
                reverseEdge,
                OrderingDirection.ASCENDING,
              ),
              new ReverseEdgeMultipleCountOrderingInputType(
                reverseEdge,
                OrderingDirection.DESCENDING,
              ),
            ]
          : [],
      ),
    ]);
  }

  public sort<
    TRequestContext extends object,
    TConnector extends ConnectorInterface,
  >(
    value: OrderByInputValue,
    context: OperationContext<TRequestContext, TConnector> | undefined,
    path: Path,
  ): NodeOrdering<TRequestContext, TConnector> {
    return new NodeOrdering(
      this.node,
      value?.length
        ? aggregateError<
            NonNillable<NodeOrderingInputValue>,
            OrderingExpression[]
          >(
            value,
            (expressions, value, index) => {
              const valuePath = addPath(path, index);

              return [
                ...expressions,
                this.getEnumValue(value, valuePath).sort(
                  context,
                  addPath(valuePath, value),
                ),
              ];
            },
            [],
            { path },
          )
        : [],
    );
  }
}
