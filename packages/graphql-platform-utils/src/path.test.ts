import assert from 'node:assert';
import { describe, it } from 'node:test';
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

  it('checks if a path is a descendant of another', () => {
    const cases = [
      [firstLevel, root],
      [secondLevel, firstLevel],
      [secondLevel, root],
      [thirdLevel, secondLevel],
      [thirdLevel, firstLevel],
      [thirdLevel, root],
    ] as const;

    cases.forEach(([a, b]) => {
      assert.strictEqual(isPathDescendantOf(a, b), true);
    });
  });

  it('gets the relative path', () => {
    const cases = [
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
            addPath(
              addPath(addPath(undefined, 'FirstLevel'), 0),
              'SecondLevel',
            ),
            5,
          ),
          'ThirdLevel',
        ),
      ],
    ] as const;

    cases.forEach(([path, ancestor, expected]) => {
      assert.deepStrictEqual(getRelativePath(path, ancestor), expected);
    });
  });

  it('prints the path', () => {
    const cases = [
      [firstLevel, undefined, '/Root/FirstLevel'],
      [firstLevel, root, './FirstLevel'],
      [secondLevel, undefined, '/Root/FirstLevel/0/SecondLevel'],
      [secondLevel, firstLevel, './0/SecondLevel'],
      [secondLevel, root, './FirstLevel/0/SecondLevel'],
      [thirdLevel, undefined, '/Root/FirstLevel/0/SecondLevel/5/ThirdLevel'],
      [thirdLevel, secondLevel, './5/ThirdLevel'],
      [thirdLevel, firstLevel, './0/SecondLevel/5/ThirdLevel'],
      [thirdLevel, root, './FirstLevel/0/SecondLevel/5/ThirdLevel'],
    ] as const;

    cases.forEach(([path, ancestor, expected]) => {
      assert.strictEqual(printPath(path, ancestor), expected);
    });
  });

  it('prepends a path', () => {
    const cases = [
      [root, '/BEFORE/Root'],
      [firstLevel, '/BEFORE/Root/FirstLevel'],
      [undefined, '/BEFORE'],
    ] as const;

    cases.forEach(([path, expected]) => {
      assert.strictEqual(printPath(prependPath('BEFORE', path)), expected);
    });
  });
});
