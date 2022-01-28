import { addPath, isPathDescendantOf, printPath } from './path.js';

describe('Path', () => {
  it('works', () => {
    const root = addPath(undefined, 'Root');

    const firstLevel = addPath(root, 'FirstLevel');
    expect(printPath(firstLevel)).toEqual('Root.FirstLevel');
    expect(isPathDescendantOf(firstLevel, root)).toBeTruthy();

    const secondLevel = addPath(addPath(firstLevel, 0), 'SecondLevel');
    expect(printPath(secondLevel)).toEqual('Root.FirstLevel.0.SecondLevel');
    expect(isPathDescendantOf(secondLevel, firstLevel)).toBeTruthy();
    expect(isPathDescendantOf(secondLevel, root)).toBeTruthy();

    const thirdLevel = addPath(addPath(secondLevel, 5), 'ThirdLevel');
    expect(printPath(thirdLevel)).toEqual(
      'Root.FirstLevel.0.SecondLevel.5.ThirdLevel',
    );
    expect(isPathDescendantOf(thirdLevel, secondLevel)).toBeTruthy();
    expect(isPathDescendantOf(thirdLevel, firstLevel)).toBeTruthy();
    expect(isPathDescendantOf(thirdLevel, root)).toBeTruthy();

    expect(printPath(thirdLevel)).toBe(
      'Root.FirstLevel.0.SecondLevel.5.ThirdLevel',
    );
    expect(printPath(thirdLevel, root)).toBe(
      'FirstLevel.0.SecondLevel.5.ThirdLevel',
    );
    expect(printPath(thirdLevel, firstLevel)).toBe(
      '0.SecondLevel.5.ThirdLevel',
    );
    expect(printPath(thirdLevel, secondLevel)).toBe('5.ThirdLevel');
  });
});
