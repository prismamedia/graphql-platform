import { UnexpectedValueError } from './errors';

export interface Path {
  readonly prev: Path | undefined;
  readonly key: string | number;
}

export function addPath(prev: Path | undefined, key: string | number): Path {
  if (typeof key === 'string' && key.includes('.')) {
    throw new UnexpectedValueError(
      key,
      `not to contains a dot (= the string character ".")`,
    );
  }

  return Object.freeze({ prev, key });
}

export function pathToArray(path: Path): Array<string | number> {
  const pathAsArray: Array<string | number> = [];

  let currentPath: Path | undefined = path;
  while (currentPath) {
    pathAsArray.unshift(currentPath.key);
    currentPath = currentPath.prev;
  }

  return pathAsArray;
}

export function printPath(path: Path): string {
  return pathToArray(path).join('.');
}
