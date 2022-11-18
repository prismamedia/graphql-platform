import { addPath as baseAddPath, type Path } from 'graphql/jsutils/Path.js';
import { InputType } from './input/type.js';
import { isPlainObject } from './plain-object.js';

export * from 'graphql/jsutils/Path.js';

export const isPath = (maybePath: unknown): maybePath is Path =>
  isPlainObject(maybePath) &&
  ['string', 'number'].includes(typeof maybePath.key) &&
  (maybePath.prev === undefined || isPath(maybePath.prev));

export const addPath = (
  prev: Path | undefined,
  key: string | number,
  type?: string | InputType,
): Path => baseAddPath(prev, key, type != null ? String(type) : undefined);

export const printPath = (path: Path, ancestor?: Path): string =>
  path.prev && path.prev !== ancestor
    ? `${printPath(path.prev, ancestor)}.${path.key}`
    : String(path.key);

export const isPathDescendantOf = (path: Path, ancestor: Path): boolean =>
  path.prev
    ? path.prev === ancestor || isPathDescendantOf(path.prev, ancestor)
    : false;
