import type { Node } from '../../../node.js';
import { Leaf } from '../../definition/component/leaf.js';
import type { NodeUniqueFilterInputValue } from '../../type/input/unique-filter.js';
import type { SelectionExpression } from './expression.js';

export interface NodeSelectedValue {
  [key: SelectionExpression['key']]: ReturnType<
    SelectionExpression['parseValue']
  >;
}

export function doesSelectedValueMatchUniqueFilter(
  node: Node,
  nodeSelectedValue: NodeSelectedValue,
  filter: NonNullable<NodeUniqueFilterInputValue>,
): boolean {
  return Object.entries(filter).every(([filterName, filterValue]) => {
    const componentSelectedValue = nodeSelectedValue[filterName];

    if (filterValue === null || componentSelectedValue == null) {
      return filterValue === componentSelectedValue;
    }

    const component = node.getComponentByName(filterName);

    return component instanceof Leaf
      ? component.areValuesEqual(
          componentSelectedValue as any,
          filterValue as any,
        )
      : doesSelectedValueMatchUniqueFilter(
          component.head,
          componentSelectedValue as NodeSelectedValue,
          filterValue as NonNullable<NodeUniqueFilterInputValue>,
        );
  });
}
