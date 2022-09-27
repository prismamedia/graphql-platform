import * as utils from '@prismamedia/graphql-platform-utils';
import assert from 'node:assert/strict';
import {
  isComponentSelection,
  type ComponentSelection,
} from './expression/component.js';
import {
  isReverseEdgeSelection,
  type ReverseEdgeSelection,
} from './expression/reverse-edge.js';

export * from './expression/component.js';
export * from './expression/reverse-edge.js';

export type SelectionExpression = ComponentSelection | ReverseEdgeSelection;

export const isSelectionExpression = (
  maybeSelection: unknown,
): maybeSelection is SelectionExpression =>
  isComponentSelection(maybeSelection) ||
  isReverseEdgeSelection(maybeSelection);

export function mergeSelectionExpressions(
  expressions: Iterable<SelectionExpression>,
  path?: utils.Path,
): Map<SelectionExpression['key'], SelectionExpression> {
  const expressionsByKey = new Map<
    SelectionExpression['key'],
    SelectionExpression
  >();

  for (const expression of expressions) {
    assert(isSelectionExpression(expression));

    const maybeSameKeyExpression = expressionsByKey.get(expression.key);

    expressionsByKey.set(
      expression.key,
      maybeSameKeyExpression
        ? maybeSameKeyExpression.mergeWith(
            expression as any,
            utils.addPath(path, expression.key),
          )
        : expression,
    );
  }

  return expressionsByKey;
}
