import { addPath, type NonNillable } from '@prismamedia/graphql-platform-utils';
import DataLoader from 'dataloader';
import type { ConnectorInterface } from '../connector-interface.js';
import type { Node } from '../node.js';
import type { OperationContext } from './operation/context.js';
import { NotFoundError } from './operation/error.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from './statement/selection.js';
import type { NodeUniqueFilterInputValue } from './type/input/unique-filter.js';

export type NodeLoader = DataLoader<
  NonNillable<NodeUniqueFilterInputValue>,
  NodeSelectedValue
>;

export function createNodeLoader<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
>(
  node: Node<TRequestContext, TConnector>,
  selection: NodeSelection,
  context: TRequestContext | OperationContext<TRequestContext, TConnector>,
): NodeLoader {
  return new DataLoader(
    async (keys) => {
      const maybeValues = await node
        .getQuery('get-some-in-order-if-exists')
        .execute({ where: keys, selection }, context);

      return maybeValues.map(
        (maybeValue, index): NodeSelectedValue | Error =>
          maybeValue ??
          new NotFoundError(node, keys[index], {
            path: addPath(undefined, index),
          }),
      );
    },
    { cache: false },
  );
}
