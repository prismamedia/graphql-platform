import {
  addPath,
  aggregateError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
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
  maybeSelectionExpression: unknown,
): maybeSelectionExpression is SelectionExpression =>
  isComponentSelection(maybeSelectionExpression) ||
  isReverseEdgeSelection(maybeSelectionExpression);

export function mergeSelectionExpressions(
  fieldSelections: Iterable<SelectionExpression>,
  path?: Path,
): Map<SelectionExpression['key'], SelectionExpression> {
  const fieldSelectionsByKey = new Map<
    SelectionExpression['key'],
    SelectionExpression
  >();

  aggregateError<SelectionExpression, void>(
    fieldSelections,
    (_, fieldSelection, index) => {
      if (!isSelectionExpression(fieldSelection)) {
        throw new UnexpectedValueError(`a field-selection`, fieldSelection, {
          path: addPath(path, index),
        });
      }

      const maybeSameKeyFieldSelection = fieldSelectionsByKey.get(
        fieldSelection.key,
      );

      fieldSelectionsByKey.set(
        fieldSelection.key,
        maybeSameKeyFieldSelection
          ? maybeSameKeyFieldSelection.mergeWith(
              fieldSelection as any,
              addPath(path, fieldSelection.key),
            )
          : fieldSelection,
      );
    },
    undefined,
    { path },
  );

  return fieldSelectionsByKey;
}
