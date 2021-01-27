import { print } from 'graphql';
import { GraphQLPlatform } from '../..';
import { models, MyGP } from '../../__tests__/config';

describe('Leaf component', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it.each<[string, string, string]>([
    ['Article', '_id', `_id`],
    ['Article', 'metas', `metas`],
  ])('defines the "%s.%s" selection', (nodeName, leafName, selectionSet) => {
    const leaf = gp.getModel(nodeName).getLeaf(leafName);

    expect(print(leaf.selection.toFieldNode())).toEqual(selectionSet);
  });
});
