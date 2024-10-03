import { describe, expect, it } from '@jest/globals';
import {
  addPath,
  getRelativePath,
  isPathDescendantOf,
  prependPath,
  printPath,
} from './path.js';

describe('Path', () => {
  const root = addPath(undefined, 'Root');
  const firstLevel = addPath(root, 'FirstLevel');
  const secondLevel = addPath(addPath(firstLevel, 0), 'SecondLevel');
  const thirdLevel = addPath(addPath(secondLevel, 5), 'ThirdLevel');

  it.each([
    [firstLevel, root],

    [secondLevel, firstLevel],
    [secondLevel, root],

    [thirdLevel, secondLevel],
    [thirdLevel, firstLevel],
    [thirdLevel, root],
  ])('.isPathDescendantOf()', (a, b) =>
    expect(isPathDescendantOf(a, b)).toBeTruthy(),
  );

  it.each([
    [firstLevel, root, addPath(undefined, 'FirstLevel')],

    [secondLevel, firstLevel, addPath(addPath(undefined, 0), 'SecondLevel')],
    [
      secondLevel,
      root,
      addPath(addPath(addPath(undefined, 'FirstLevel'), 0), 'SecondLevel'),
    ],

    [thirdLevel, secondLevel, addPath(addPath(undefined, 5), 'ThirdLevel')],
    [
      thirdLevel,
      firstLevel,
      addPath(
        addPath(addPath(addPath(undefined, 0), 'SecondLevel'), 5),
        'ThirdLevel',
      ),
    ],
    [
      thirdLevel,
      root,
      addPath(
        addPath(
          addPath(addPath(addPath(undefined, 'FirstLevel'), 0), 'SecondLevel'),
          5,
        ),
        'ThirdLevel',
      ),
    ],
  ])('.getRelativePath()', (path, ancestor, expected) =>
    expect(getRelativePath(path, ancestor)).toEqual(expected),
  );

  it.each([
    [firstLevel, undefined, '/Root/FirstLevel'],
    [firstLevel, root, './FirstLevel'],

    [secondLevel, undefined, '/Root/FirstLevel/0/SecondLevel'],
    [secondLevel, firstLevel, './0/SecondLevel'],
    [secondLevel, root, './FirstLevel/0/SecondLevel'],

    [thirdLevel, undefined, '/Root/FirstLevel/0/SecondLevel/5/ThirdLevel'],
    [thirdLevel, secondLevel, './5/ThirdLevel'],
    [thirdLevel, firstLevel, './0/SecondLevel/5/ThirdLevel'],
    [thirdLevel, root, './FirstLevel/0/SecondLevel/5/ThirdLevel'],
  ])('.printPath()', (path, ancestor, expected) =>
    expect(printPath(path, ancestor)).toBe(expected),
  );

  it.each([
    [root, '/BEFORE/Root'],
    [firstLevel, '/BEFORE/Root/FirstLevel'],
    [undefined, '/BEFORE'],
  ])('.prependPath()', (path, expected) =>
    expect(printPath(prependPath('BEFORE', path))).toBe(expected),
  );
});
