import { addPath as baseAddPath, type Path } from 'graphql/jsutils/Path.js';
import assert from 'node:assert/strict';
import type { InputType } from './input/type.js';
import { isPlainObject } from './plain-object.js';

export * from 'graphql/jsutils/Path.js';

export const isPath = (maybePath: unknown): maybePath is Path =>
  isPlainObject(maybePath) &&
  ['string', 'number'].includes(typeof maybePath['key']) &&
  (maybePath['prev'] === undefined || isPath(maybePath['prev']));

export const addPath = (
  prev: Path | undefined,
  key: string | number,
  type?: string | InputType,
): Path => baseAddPath(prev, key, type != null ? String(type) : undefined);

export function isPathDescendantOf(path: Path, maybeAncestor: Path): boolean {
  assert.notEqual(
    path,
    maybeAncestor,
    `Expects the "path" to be different of the "maybeAncestor"`,
  );

  return path.prev
    ? path.prev === maybeAncestor ||
        isPathDescendantOf(path.prev, maybeAncestor)
    : false;
}

export function arePathsEqual(a: Path, b: Path): boolean {
  return (
    a === b ||
    (a.key === b.key &&
      (a.prev && b.prev ? arePathsEqual(a.prev, b.prev) : !a.prev && !b.prev))
  );
}

export function isPathEqualOrDescendantOf(
  path: Path,
  maybeAncestor: Path,
): boolean {
  return path === maybeAncestor || isPathDescendantOf(path, maybeAncestor);
}

export function isPathAncestorOf(path: Path, maybeDescendant: Path): boolean {
  assert.notEqual(
    path,
    maybeDescendant,
    `Expects the "path" to be different of the "maybeDescendant"`,
  );

  return isPathAncestorOf(maybeDescendant, path);
}

export function getRelativePath(path: Path, ancestor: Path): Path {
  assert(
    isPathDescendantOf(path, ancestor),
    `Expects the "path" to be a descendant of the "ancestor"`,
  );

  return addPath(
    path.prev && path.prev !== ancestor
      ? getRelativePath(path.prev, ancestor)
      : undefined,
    path.key,
    path.typename,
  );
}

export const printPath = (path: Path, ancestor?: Path): string =>
  ancestor
    ? `.${printPath(getRelativePath(path, ancestor))}`
    : path.prev
      ? `${printPath(path.prev)}/${path.key}`
      : `/${path.key}`;
