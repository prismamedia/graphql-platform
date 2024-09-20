import type * as utils from '@prismamedia/graphql-platform-utils';
import DataLoader from 'dataloader';
import type { Node } from '../node.js';
import type { OperationContext } from './operation/context.js';
import { NotFoundError } from './operation/error.js';
import type { NodeSelectedValue } from './statement/selection.js';
import type { NodeFilterInputValue } from './type/input/filter.js';
import type { NodeUniqueFilterInputValue } from './type/input/unique-filter.js';
import type { RawNodeSelection } from './type/output.js';

export type NodeLoader<TValue extends NodeSelectedValue> = DataLoader<
  NonNullable<NodeUniqueFilterInputValue>,
  TValue
>;

export function createNodeLoader<
  TRequestContext extends object,
  TValue extends NodeSelectedValue,
>(
  node: Node<TRequestContext>,
  context: utils.Thunkable<TRequestContext> | OperationContext<TRequestContext>,
  rawSelection: RawNodeSelection<TValue>,
  {
    subset,
    ...options
  }: {
    subset?: NodeFilterInputValue;
  } & DataLoader.Options<NonNullable<NodeUniqueFilterInputValue>, TValue> = {},
): NodeLoader<TValue> {
  const api = node.createContextBoundAPI(context);
  const selection = node.outputType.select(rawSelection);

  return new DataLoader<NonNullable<NodeUniqueFilterInputValue>, TValue>(
    async (ids) => {
      const maybeValues = (await api.getSomeInOrderIfExists({
        where: ids,
        subset,
        selection,
      })) as (TValue | null)[];

      return maybeValues.map(
        (maybeValue, index) =>
          maybeValue ?? new NotFoundError(node, ids[index]),
      );
    },
    { cache: false, ...options },
  );
}
