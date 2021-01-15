import { GraphQLInputObjectType, printType } from 'graphql';
import { GraphQLPlatform } from '..';
import { MyGP, nodeNames, nodes } from '../__tests__/config';
import { TWhereInputValue, WhereInput } from './where-input';
import { TEdgeFilterValue, TFilterValue } from './where-input/ast';
import { isReferenceFilterValue } from './where-input/optimization';

describe('WhereInput', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  it.each(nodeNames)('has a(n) %sWhereInput', (nodeName) => {
    const node = gp.getNode(nodeName);
    const whereInput = node.whereInput;

    expect(whereInput).toBeInstanceOf(WhereInput);
    expect(whereInput.public).toEqual(node.public);

    if (whereInput.public) {
      expect(whereInput.type).toBeInstanceOf(GraphQLInputObjectType);
      expect(
        printType(whereInput.type, { commentDescriptions: true }),
      ).toMatchSnapshot(whereInput.name);
    } else {
      expect(() => whereInput.type).toThrowError(
        `"${nodeName}WhereInput" is private`,
      );
    }
  });

  it.each([
    [
      'Article',
      { id_is_null: true },
      'At ArticleWhereInput - expects not to contain the extra field(s) "id_is_null", got: {"id_is_null":true}',
    ],
    [
      'Article',
      { id: null },
      `At ArticleWhereInput.id - expects a non-null value`,
    ],
    [
      'Article',
      { id: 123 },
      `At ArticleWhereInput.id - expects a valid "UUID", got: 123`,
    ],
    [
      'Article',
      { category: { parent: { title: null } } },
      `At ArticleWhereInput.category.parent.title - expects a non-null value`,
    ],
  ])(
    'throws an Error on %sWhereInput.parseValue(%p)',
    (nodeName, value, error) => {
      const node = gp.getNode(nodeName);
      const whereInput = node.whereInput;

      expect(() => whereInput.parseValue(value)).toThrowError(error);
    },
  );

  it.each<
    [string, TWhereInputValue | boolean | null | undefined, TFilterValue]
  >([
    ['Article', undefined, { kind: 'Boolean', value: true }],
    ['Article', null, { kind: 'Boolean', value: false }],
    ['Article', false, { kind: 'Boolean', value: false }],
    ['Article', true, { kind: 'Boolean', value: true }],

    // An empty "{}" is equal to "{ AND: [] }" is equal to "true"
    ['Article', {}, { kind: 'Boolean', value: true }],
    ['Article', { AND: [] }, { kind: 'Boolean', value: true }],

    // An empty "{ OR: [] }" is equal to "false"
    ['Article', { OR: [] }, { kind: 'Boolean', value: false }],

    // A simple leaf filter
    [
      'Article',
      { id: '94de8a4b-a25f-4659-ba13-c84761ef135b' },
      {
        kind: 'Leaf',
        leaf: 'id',
        operator: 'eq',
        value: '94de8a4b-a25f-4659-ba13-c84761ef135b',
      },
    ],

    // A simple edge filter
    [
      'Article',
      { category: { id: '66fd100c-1c47-469d-a89a-ce9a3fdb8470' } },
      {
        kind: 'Edge',
        edge: 'category',
        operator: 'eq',
        value: {
          kind: 'Leaf',
          leaf: 'id',
          operator: 'eq',
          value: '66fd100c-1c47-469d-a89a-ce9a3fdb8470',
        },
      },
    ],
    [
      'Article',
      // An article WITH any "category"
      { category: {} },
      {
        kind: 'Edge',
        edge: 'category',
        operator: 'eq',
        value: {
          kind: 'Boolean',
          value: true,
        },
      },
    ],
    [
      'Article',
      // An article WITHOUT any "category"
      { category: null },
      {
        kind: 'Edge',
        edge: 'category',
        operator: 'eq',
        value: {
          kind: 'Boolean',
          value: false,
        },
      },
    ],
    [
      'Article',
      // An article WITH any "createdBy" (as "createdBy" is non-null, we can remove this filter as it always true)
      { createdBy: {} },
      {
        kind: 'Boolean',
        value: true,
      },
    ],
    [
      'Article',
      // An article WITHOUT any "createdBy" (as "createdBy" is non-null, it is impossible) - as null is forbidden for a non-null edge, we use the optimisation of "{ OR: [] }" into "false"
      { createdBy: { OR: [] } },
      {
        kind: 'Boolean',
        value: false,
      },
    ],
    [
      'Article',
      { OR: [{ title: 'My title' }, { title: 'My title' }] },
      { kind: 'Leaf', leaf: 'title', operator: 'eq', value: 'My title' },
    ],
    ['Article', { NOT: {} }, { kind: 'Boolean', value: false }],
    ['Article', { NOT: { NOT: {} } }, { kind: 'Boolean', value: true }],
    [
      'Article',
      {
        createdAt_in: [
          new Date('2020-10-26T12:12:12.000Z'),
          new Date('2020-10-26T12:12:12.000Z'),
        ],
      },
      {
        kind: 'Leaf',
        leaf: 'createdAt',
        operator: 'eq',
        value: new Date('2020-10-26T12:12:12.000Z'),
      },
    ],
    [
      'Article',
      {
        _id: 123,
        title_not: 'My random title',
        body_is_null: false,
        OR: [
          { category_is_null: true },
          { category: { _id: 456 } },
          { category: { id: '367665fb-b29b-43d3-b6d0-ec70aaf2f703' } },
        ],
      },
      {
        kind: 'Logical',
        operator: 'and',
        value: [
          {
            kind: 'Leaf',
            leaf: '_id',
            operator: 'eq',
            value: 123,
          },
          {
            kind: 'Leaf',
            leaf: 'title',
            operator: 'not',
            value: 'My random title',
          },
          {
            kind: 'Leaf',
            leaf: 'body',
            operator: 'not',
            value: null,
          },
          {
            kind: 'Logical',
            operator: 'or',
            value: [
              {
                kind: 'Edge',
                edge: 'category',
                operator: 'eq',
                value: {
                  kind: 'Boolean',
                  value: false,
                },
              },
              {
                kind: 'Edge',
                edge: 'category',
                operator: 'eq',
                value: {
                  kind: 'Leaf',
                  leaf: '_id',
                  operator: 'eq',
                  value: 456,
                },
              },
              {
                kind: 'Edge',
                edge: 'category',
                operator: 'eq',
                value: {
                  kind: 'Leaf',
                  leaf: 'id',
                  operator: 'eq',
                  value: '367665fb-b29b-43d3-b6d0-ec70aaf2f703',
                },
              },
            ],
          },
        ],
      },
    ],
    [
      'Category',
      {
        OR: [
          {
            parent: null,
            order: 0,
          },
          {
            parent: null,
            slug: 'my-home',
          },
        ],
      },
      {
        kind: 'Logical',
        operator: 'or',
        value: [
          {
            kind: 'Logical',
            operator: 'and',
            value: [
              {
                kind: 'Edge',
                edge: 'parent',
                operator: 'eq',
                value: {
                  kind: 'Boolean',
                  value: false,
                },
              },
              {
                kind: 'Leaf',
                leaf: 'order',
                operator: 'eq',
                value: 0,
              },
            ],
          },
          {
            kind: 'Logical',
            operator: 'and',
            value: [
              {
                kind: 'Leaf',
                leaf: 'slug',
                operator: 'eq',
                value: 'my-home',
              },
              {
                kind: 'Edge',
                edge: 'parent',
                operator: 'eq',
                value: {
                  kind: 'Boolean',
                  value: false,
                },
              },
            ],
          },
        ],
      },
    ],
  ])('%sWhereInput.parseValue(%p) = %p', (nodeName, value, parsedValue) => {
    const node = gp.getNode(nodeName);
    const whereInput = node.whereInput;

    expect(whereInput.parseValue(value)).toEqual(parsedValue);
  });

  it.each<
    [nodeName: string, edgeFilterValue: TEdgeFilterValue, expectation: boolean]
  >([
    [
      'Article',
      {
        kind: 'Edge',
        edge: 'category',
        operator: 'eq',
        value: {
          kind: 'Leaf',
          leaf: 'id',
          operator: 'eq',
          value: '5287c3fb-73e9-4a1b-bc57-3cb5ffc2de61',
        },
      },
      false,
    ],
    [
      'Article',
      {
        kind: 'Edge',
        edge: 'category',
        operator: 'eq',
        value: {
          kind: 'Logical',
          operator: 'and',
          value: [
            {
              kind: 'Edge',
              edge: 'parent',
              operator: 'eq',
              value: {
                kind: 'Leaf',
                leaf: '_id',
                operator: 'eq',
                value: 123,
              },
            },
            {
              kind: 'Leaf',
              leaf: 'slug',
              operator: 'in',
              value: ['tv', 'sport', 'music'],
            },
          ],
        },
      },
      true,
    ],
  ])(
    'isReferenceFilterValue() detects when an edge filter is actually only a reference filter',
    (nodeName, edgeFilterValue, expectation) => {
      const node = gp.getNode(nodeName);

      expect(
        isReferenceFilterValue(
          edgeFilterValue,
          node.getEdge(edgeFilterValue.edge),
        ),
      ).toEqual(expectation);
    },
  );
});
