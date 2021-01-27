import {
  addPath as baseAddPath,
  Path,
  pathToArray,
} from 'graphql/jsutils/Path';

export * from 'graphql/jsutils/Path';

export function addPath(
  prev: Path | undefined,
  key: string | number,
  typename?: string,
): Path {
  return baseAddPath(prev, key, typename);
}

export function printPath(path: Path): string {
  return pathToArray(path).join('.');
}
