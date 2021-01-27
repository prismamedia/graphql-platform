import { addPath, printPath } from './path';

describe('Path', () => {
  it('works', () => {
    const root = addPath(undefined, 'Root');

    expect(printPath(addPath(root, 'FirstLevelChild'))).toEqual(
      'Root.FirstLevelChild',
    );

    expect(
      printPath(
        addPath(addPath(addPath(root, 'FirstLevelChild'), 0), 'FirstElement'),
      ),
    ).toEqual('Root.FirstLevelChild.0.FirstElement');
  });
});
