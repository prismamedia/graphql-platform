import {
  parseArgumentNodes,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { FieldNode } from 'graphql';

export function assertGraphQLFieldNodeWithoutArguments(
  args: FieldNode['arguments'],
  path?: Path,
): asserts args is undefined {
  if (args?.length) {
    throw new UnexpectedValueError(
      parseArgumentNodes(args),
      `not to have arguments`,
      path,
    );
  }
}

export function assertGraphQLFieldNodeWithoutSelectionSet(
  selectionSet: FieldNode['selectionSet'],
  path?: Path,
): asserts selectionSet is undefined {
  if (selectionSet) {
    throw new UnexpectedValueError(
      selectionSet,
      `not to have selectionSet`,
      path,
    );
  }
}

export function assertGraphQLFieldNodeWithSelectionSet(
  selectionSet: FieldNode['selectionSet'],
  path?: Path,
): asserts selectionSet is NonNullable<FieldNode['selectionSet']> {
  if (!selectionSet) {
    throw new UnexpectedValueError(selectionSet, 'a selectionSet', path);
  }
}
