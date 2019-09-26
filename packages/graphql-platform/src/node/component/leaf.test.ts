import { GraphQLPlatform } from '../..';
import { MyGP, nodes } from '../../__tests__/config';
import { TFieldSelection } from '../fields';

describe('Leaf component', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it.each<[string, TFieldSelection]>([
    [
      'Article._id',
      {
        kind: 'Leaf',
        name: '_id',
      },
    ],
    [
      'Article.metas',
      {
        kind: 'Leaf',
        name: 'metas',
      },
    ],
  ])('defines its selection', (leafId, selection) => {
    const leaf = gp.getNodeLeaf(leafId);

    expect(leaf.selection).toEqual(selection);
  });
});
