import { GraphQLPlatform } from '../..';
import { Category, MyGP, nodes } from '../../__tests__/config';
import { IEdgeSelection } from '../fields/edge';

describe('Edge component', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it('throws an Error on referencing itself', () => {
    expect(
      () =>
        new GraphQLPlatform({
          nodes: {
            Category: {
              ...Category,
              components: {
                ...Category.components,
                parent: {
                  type: 'Category',
                  reference: 'parent-slug',
                },
              },
            },
          },
        }),
    ).toThrowError('The "Category.parent" edge cannot references itself');
  });

  it.each<[string, IEdgeSelection]>([
    [
      'Article.category',
      {
        kind: 'Edge',
        name: 'category',
        selections: [
          {
            kind: 'Edge',
            name: 'parent',
            selections: [
              {
                kind: 'Leaf',
                name: '_id',
              },
            ],
          },
          {
            kind: 'Leaf',
            name: 'slug',
          },
        ],
      },
    ],
    [
      'Article.createdBy',
      {
        kind: 'Edge',
        name: 'createdBy',
        selections: [
          {
            kind: 'Leaf',
            name: 'id',
          },
        ],
      },
    ],
    [
      'Article.updatedBy',
      {
        kind: 'Edge',
        name: 'updatedBy',
        selections: [
          {
            kind: 'Leaf',
            name: 'username',
          },
        ],
      },
    ],
  ])('defines its reference selection', (edgeId, selection) => {
    const edge = gp.getNodeEdge(edgeId);

    expect(edge.selection).toEqual(selection);
  });
});
