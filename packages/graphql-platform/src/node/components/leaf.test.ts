import { GraphQLPlatform } from '../..';
import { MyGP, nodes } from '../../__tests__/config';
import { TFieldSelection } from '../output/fields';

describe('Leaf component', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it.each<[string, string, TFieldSelection]>([
    [
      'Article',
      '_id',
      {
        kind: 'Leaf',
        name: '_id',
      },
    ],
    [
      'Article',
      'metas',
      {
        kind: 'Leaf',
        name: 'metas',
      },
    ],
  ])('defines its selection', (nodeName, leafName, selection) => {
    const leaf = gp.getNode(nodeName).getLeaf(leafName);

    expect(leaf.selection).toEqual(selection);
  });
});
