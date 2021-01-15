import assert from 'assert';

export interface Path {
  readonly prev: Path | undefined;
  readonly key: string | number;
}

export function addPath(prev: Path | undefined, key: string | number): Path {
  assert(
    typeof key === 'number' || !key.includes('.'),
    'The key cannot contain a dot (= ".")',
  );

  return { prev, key };
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
