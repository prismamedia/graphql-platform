import {
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { strict as assert } from 'assert';
import { FieldNode } from 'graphql';
import { AbstractSelection } from './abstract';

export function assertGraphQLFieldNodeWithoutArguments(
  args: FieldNode['arguments'],
  path?: Path,
): asserts args is undefined {
  if (args?.length) {
    throw new UnexpectedValueError(args, `not to have arguments`, path);
  }
}

export function assertGraphQLFieldNodeWithArguments(
  args: FieldNode['arguments'],
  path?: Path,
): asserts args is NonNullable<FieldNode['arguments']> {
  if (!args?.length) {
    throw new UnexpectedValueError(args, `arguments`, path);
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

export function assertHomogeneousSelections<
  TSelection extends AbstractSelection,
>(
  base: TSelection,
  selections: ReadonlyArray<TSelection>,
): asserts selections is ReadonlyArray<TSelection> {
  selections.forEach((selection) => {
    assert(
      selection instanceof base.constructor,
      `Cannot merge the selection "${selection.constructor}" with "${base.constructor}"`,
    );
    assert.equal(
      selection.field,
      base.field,
      `Cannot merge the field "${selection.field}" with "${base.field}"`,
    );
    assert.equal(
      selection.key,
      base.key,
      `Cannot merge the key "${selection.key}" with "${base.key}"`,
    );
  });
}
