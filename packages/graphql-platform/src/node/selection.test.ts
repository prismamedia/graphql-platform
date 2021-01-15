import { GraphQLPlatform } from '..';
import { MyGP, nodes } from '../__tests__/config';
import { IEdgeSelection, TFieldSelection } from './fields';
import { isReferenceSelection, parseFragmentSelections } from './selection';

describe('Node selection', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it.each([
    [
      'Article',
      undefined,
      `At Article - expects a stringified fragment, got: undefined`,
    ],
    ['Article', null, `At Article - expects a stringified fragment, got: null`],
    [
      'Article',
      `{ unknownField }`,
      'At Article - the "Article" node does not contain the field "unknownField", did you mean: ',
    ],
    [
      'Article',
      `{ category { unknownDeepField } }`,
      'At Article.category - the "Category" node does not contain the field "unknownDeepField", did you mean: ',
    ],
    [
      'Article',
      `{ id(first: 5) }`,
      'At Article.id - expects not to have arguments, got: {"first":5}',
    ],
    [
      'Article',
      `{ id { id } }`,
      'At Article.id - expects not to have selectionSet, got:',
    ],
  ])('throws an Error on %p.parseFragment(%p)', (nodeName, fragment, error) => {
    const node = gp.getNode(nodeName);

    expect(() =>
      parseFragmentSelections(
        node,
        // @ts-expect-error
        fragment,
      ),
    ).toThrowError(error);
  });

  it.each<
    [
      nodeName: string,
      fragment: string,
      selections: ReadonlyArray<TFieldSelection>,
    ]
  >([
    ['Article', `{ id }`, [{ kind: 'Leaf', name: 'id' }]],
    ['Article', `... { id }`, [{ kind: 'Leaf', name: 'id' }]],
    ['Article', `... on Article { id }`, [{ kind: 'Leaf', name: 'id' }]],
    [
      'Article',
      `fragment MyTestFragment on Article { id }`,
      [{ kind: 'Leaf', name: 'id' }],
    ],
    [
      'Article',
      `{ _id id }`,
      [
        { kind: 'Leaf', name: '_id' },
        { kind: 'Leaf', name: 'id' },
      ],
    ],
    [
      'Article',
      `{ id category { id hasParent } }`,
      [
        { kind: 'Leaf', name: 'id' },
        {
          kind: 'Edge',
          name: 'category',
          selections: [
            { kind: 'Leaf', name: 'id' },
            { kind: 'EdgeExistence', name: 'hasParent', edge: 'parent' },
          ],
        },
      ],
    ],
    [
      'Article',
      `{ _id lowerCasedTitle }`,
      [
        { kind: 'Leaf', name: '_id' },
        { kind: 'Leaf', name: 'status' },
        { kind: 'Leaf', name: 'title' },
        {
          kind: 'Edge',
          name: 'category',
          selections: [{ kind: 'Leaf', name: 'title' }],
        },
        { kind: 'Custom', name: 'lowerCasedTitle' },
      ],
    ],
    [
      'Article',
      `{
        title
        category {
          parent { slug }
          slug
        }
        tags(where: { order_lt: 10 }, first: 5) {
          order
          tag { title }
          ... on ArticleTag {
            tag {
              slug
              ... on Tag { id }
              id
            }
          }
        }
        tagCount
      }`,
      [
        { kind: 'Leaf', name: 'title' },
        {
          kind: 'Edge',
          name: 'category',
          selections: [
            {
              kind: 'Edge',
              name: 'parent',
              selections: [{ kind: 'Leaf', name: 'slug' }],
            },
            { kind: 'Leaf', name: 'slug' },
          ],
        },
        {
          kind: 'ReverseEdge',
          name: 'tags',
          args: {
            filter: { kind: 'Leaf', leaf: 'order', operator: 'lt', value: 10 },
            orderBy: [{ kind: 'Leaf', leaf: 'order', direction: 'ASC' }],
            first: 5,
          },
          selections: [
            { kind: 'Leaf', name: 'order' },
            {
              kind: 'Edge',
              name: 'tag',
              selections: [
                { kind: 'Leaf', name: 'title' },
                { kind: 'Leaf', name: 'slug' },
                { kind: 'Leaf', name: 'id' },
              ],
            },
          ],
        },
        {
          kind: 'ReverseEdgeCount',
          name: 'tagCount',
          reverseEdge: 'tags',
        },
      ],
    ],
    [
      'Article',
      `{ id category { parent { _id } slug } }`,
      [
        {
          kind: 'Leaf',
          name: 'id',
        },
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
    ],
  ])('%p.parseFragment(%p) = %p', (nodeName, fragment, selections) => {
    const node = gp.getNode(nodeName);

    expect(parseFragmentSelections(node, fragment)).toEqual(selections);
  });

  it.each<
    [nodeName: string, edgeSelection: IEdgeSelection, expectation: boolean]
  >([
    [
      'Article',
      {
        kind: 'Edge',
        name: 'category',
        selections: [
          {
            kind: 'Leaf',
            name: 'id',
          },
        ],
      },
      false,
    ],
    [
      'Article',
      {
        kind: 'Edge',
        name: 'category',
        selections: [
          {
            kind: 'Edge',
            name: 'parent',
            selections: [{ kind: 'Leaf', name: '_id' }],
          },
          { kind: 'Leaf', name: 'slug' },
        ],
      },
      true,
    ],
  ])(
    'isReferenceSelection() detects when an edge selection is actually only a reference selection',
    (nodeName, edgeSelection, expectation) => {
      const node = gp.getNode(nodeName);

      expect(
        isReferenceSelection(edgeSelection, node.getEdge(edgeSelection.name)),
      ).toEqual(expectation);
    },
  );
});
