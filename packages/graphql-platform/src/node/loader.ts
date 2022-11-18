import * as utils from '@prismamedia/graphql-platform-utils';
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

export type NodeLoaderKey = NonNullable<NodeUniqueFilterInputValue>;

export type NodeLoaderValue = NodeSelectedValue;

export type NodeLoader = DataLoader<NodeLoaderKey, NodeLoaderValue>;

export function createNodeLoader<
  TRequestContext extends object,
  TConnector extends ConnectorInterface,
  TCacheKey = NodeLoaderKey,
>(
  node: Node<TRequestContext, TConnector>,
  selection: NodeSelection,
  context: TRequestContext | OperationContext<TRequestContext, TConnector>,
  options?: DataLoader.Options<NodeLoaderKey, NodeLoaderValue, TCacheKey>,
): NodeLoader {
  return new DataLoader(async (keys) => {
    const maybeValues = await node
      .getQueryByKey('get-some-in-order-if-exists')
      .execute({ where: keys, selection }, context);

    return maybeValues.map(
      (maybeValue, index): NodeSelectedValue | Error =>
        maybeValue ??
        new NotFoundError(node, keys[index], {
          path: utils.addPath(undefined, index),
        }),
    );
  }, options);
}
