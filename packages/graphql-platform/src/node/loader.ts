import * as utils from '@prismamedia/graphql-platform-utils';
import DataLoader from 'dataloader';
import type { Node } from '../node.js';
import type { OperationContext } from './operation/context.js';
import { NotFoundError } from './operation/error.js';
import type {
  NodeSelectedValue,
  NodeSelection,
} from './statement/selection.js';
import type { NodeFilterInputValue } from './type/input/filter.js';
import type { NodeUniqueFilterInputValue } from './type/input/unique-filter.js';

export type NodeLoaderKey = NonNullable<NodeUniqueFilterInputValue>;

export type NodeLoaderValue = NodeSelectedValue;

export type NodeLoader = DataLoader<NodeLoaderKey, NodeLoaderValue>;

export function createNodeLoader<
  TRequestContext extends object,
  TCacheKey = NodeLoaderKey,
>(
  node: Node<TRequestContext>,
  context: utils.Thunkable<TRequestContext> | OperationContext<TRequestContext>,
  selection: NodeSelection,
  {
    subset,
    ...options
  }: {
    subset?: NodeFilterInputValue;
  } & DataLoader.Options<NodeLoaderKey, NodeLoaderValue, TCacheKey> = {},
): NodeLoader {
  const api = node.createContextBoundAPI(context);

  return new DataLoader(async (keys) => {
    const maybeValues = await api.getSomeInOrderIfExists({
      where: keys,
      subset,
      selection,
    });

    return maybeValues.map(
      (maybeValue, index): NodeSelectedValue | Error =>
        maybeValue ??
        new NotFoundError(node, keys[index], {
          path: utils.addPath(undefined, index),
        }),
    );
  }, options);
}
