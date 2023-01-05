import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import { GraphQLPlatform } from '../../../index.js';
import {
  ArticleStatus,
  MyGP,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { BooleanFilter } from '../../statement.js';
import { NodeFilterInputType, NodeFilterInputValue } from './filter.js';

describe('NodeFilterInputType', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has a filter input type', (nodeName) => {
      const node = gp.getNodeByName(nodeName);

      const filterInputType = node.filterInputType;
      expect(filterInputType).toBeInstanceOf(NodeFilterInputType);

      if (node.isPublic()) {
        expect(filterInputType.getGraphQLInputType()).toBeInstanceOf(
          graphql.GraphQLInputObjectType,
        );
        expect(
          graphql.printType(filterInputType.getGraphQLInputType()),
        ).toMatchSnapshot(filterInputType.name);
      } else {
        expect(() => filterInputType.getGraphQLInputType()).toThrowError(
          `The "${nodeName}FilterInput" input type is private`,
        );
      }
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      it.each([
        [
          'Article',
          { id_is_null: true },
          'Expects not to contain the extra key(s): id_is_null',
        ],
        ['Article', { id: null }, '/id - Expects a non-null "UUIDv4"'],
        ['Article', { id: 123 }, `/id - Expects an "UUIDv4", got: 123`],
        [
          'Article',
          { category: { parent: { title: null } } },
          '/category/parent/title - Expects a non-null "NonEmptyTrimmedString"',
        ],
      ])(
        '%# - %sFilterInput.parseAndFilter(%p) throws the error %p',
        (nodeName, input, error) => {
          const node = gp.getNodeByName(nodeName);
          const filterInputType = node.filterInputType;

          expect(() => filterInputType.parseAndFilter(input)).toThrowError(
            error,
          );
        },
      );

      it('throws an UnauthorizedError', () => {});
    });

    describe(`Works`, () => {
      describe(`Reduces to FALSE`, () => {
        // These filters return FALSE
        it.each<NodeFilterInputValue>([
          null,
          { id_in: [] },
          { OR: [] },
          { OR: [null] },
          { category: { OR: [] } },
          { category: { OR: [null] } },
          { updatedBy: { OR: [] } },
          { updatedBy: { OR: [null] } },
          { NOT: {} },
          { NOT: { id: undefined } },
        ])('%# - ArticleFilterInput.filter(%p) = FALSE', (input) => {
          const node = gp.getNodeByName('Article');
          const filterInputType = node.filterInputType;

          expect(
            filterInputType
              .parseAndFilter(
                input,
                undefined,
                utils.addPath(undefined, filterInputType.name),
              )
              .isFalse(),
          ).toBeTruthy();
        });
      });

      describe(`Reduces to TRUE`, () => {
        // These filters return TRUE
        it.each<NodeFilterInputValue>([
          undefined,
          {},
          { id: undefined },
          { id_not_in: [] },
          { AND: [] },
          { AND: [undefined] },
          { AND: [{}] },
          { AND: [{ id: undefined }] },
          { OR: [undefined] },
          { OR: [{}] },
          { OR: [{ id: undefined }] },
          { NOT: undefined },
        ])('%# - ArticleFilterInput.filter(%p) = TRUE', (input) => {
          const node = gp.getNodeByName('Article');
          const filterInputType = node.filterInputType;

          expect(
            filterInputType
              .parseAndFilter(
                input,
                undefined,
                utils.addPath(undefined, filterInputType.name),
              )
              .isTrue(),
          ).toBeTruthy();
        });
      });

      describe(`Reduces`, () => {
        describe('Components', () => {
          describe(`Leafs`, () => {
            it.each<
              [
                label: string,
                filter: NodeFilterInputValue,
                ast: BooleanFilter['ast'],
              ]
            >([
              [
                `"OR"'s idempotence law`,
                { _id_in: [1, 2, 3, 2, 1] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'in',
                  values: [1, 2, 3],
                },
              ],

              [
                `"AND"'s idempotence law`,
                { AND: [{ _id: 1 }, { _id: 1 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'eq',
                  value: 1,
                },
              ],

              [
                `"OR/AND"'s idempotence law`,
                {
                  AND: [{ _id_in: [1, 2, 3, 4] }, { _id_in: [2, 3, 4, 1] }],
                  OR: [{ _id_in: [3, 4, 1, 2] }, { _id_in: [4, 1, 2, 3] }],
                },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'in',
                  values: [1, 2, 3, 4],
                },
              ],

              [
                `"OR"'s absorption law`,
                {
                  OR: [
                    { _id: 1 },
                    { AND: [{ _id: 1 }, { status: ArticleStatus.PUBLISHED }] },
                  ],
                },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'eq',
                  value: 1,
                },
              ],

              [
                `"AND"'s absorption law`,
                {
                  AND: [
                    { _id: 1 },
                    { OR: [{ _id: 1 }, { status: ArticleStatus.PUBLISHED }] },
                  ],
                },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'eq',
                  value: 1,
                },
              ],

              [
                `"OR"'s complementation`,
                { OR: [{ _id: 5 }, { _id_not: 5 }] },
                {
                  kind: 'BooleanValue',
                  value: true,
                },
              ],

              [
                `"AND"'s complementation`,
                { AND: [{ _id: 5 }, { _id_not: 5 }] },
                {
                  kind: 'BooleanValue',
                  value: false,
                },
              ],

              [
                `"AND"'s sortable-optimization - 0`,
                { AND: [{ _id: 5 }, { _id_gt: 5 }] },
                {
                  kind: 'BooleanValue',
                  value: false,
                },
              ],

              [
                `"AND"'s sortable-optimization - 1`,
                { AND: [{ _id: 5 }, { _id_gt: 4 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'eq',
                  value: 5,
                },
              ],

              [
                `"AND"'s sortable-optimization - 2`,
                { AND: [{ _id: 5 }, { _id_gte: 6 }] },
                {
                  kind: 'BooleanValue',
                  value: false,
                },
              ],

              [
                `"AND"'s sortable-optimization - 3`,
                { AND: [{ _id: 5 }, { _id_gte: 5 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'eq',
                  value: 5,
                },
              ],

              [
                `"AND"'s sortable-optimization - 4`,
                { AND: [{ _id: 5 }, { _id_lt: 5 }] },
                {
                  kind: 'BooleanValue',
                  value: false,
                },
              ],

              [
                `"AND"'s sortable-optimization - 5`,
                { AND: [{ _id: 5 }, { _id_lt: 6 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'eq',
                  value: 5,
                },
              ],

              [
                `"AND"'s sortable-optimization - 6`,
                { AND: [{ _id: 5 }, { _id_lte: 4 }] },
                {
                  kind: 'BooleanValue',
                  value: false,
                },
              ],

              [
                `"AND"'s sortable-optimization - 7`,
                { AND: [{ _id: 5 }, { _id_lte: 5 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'eq',
                  value: 5,
                },
              ],

              [
                `"AND"'s sortable-optimization - 8`,
                { AND: [{ _id_gt: 5 }, { _id_gt: 10 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'gt',
                  value: 10,
                },
              ],

              [
                `"AND"'s sortable-optimization - 9`,
                { AND: [{ _id_gte: 5 }, { _id_gte: 10 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'gte',
                  value: 10,
                },
              ],

              [
                `"AND"'s sortable-optimization - 10`,
                { AND: [{ _id_lt: 5 }, { _id_lt: 10 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'lt',
                  value: 5,
                },
              ],

              [
                `"AND"'s sortable-optimization - 11`,
                { AND: [{ _id_lte: 5 }, { _id_lte: 10 }] },
                {
                  kind: 'LeafFilter',
                  leaf: '_id',
                  operator: 'lte',
                  value: 5,
                },
              ],

              [
                `A simple logical "AND" filter over some leaves' value`,
                {
                  id: '94de8a4b-a25f-4659-ba13-c84761ef135b',
                  title_contains: 'FRANCE',
                  createdAt_gte: '2021-01-01T00:00:00Z',
                },
                {
                  kind: 'BooleanOperation',
                  operator: 'And',
                  operands: [
                    {
                      kind: 'LeafFilter',
                      leaf: 'id',
                      operator: 'eq',
                      value: '94de8a4b-a25f-4659-ba13-c84761ef135b',
                    },
                    {
                      kind: 'LeafFilter',
                      leaf: 'title',
                      operator: 'contains',
                      value: 'FRANCE',
                    },
                    {
                      kind: 'LeafFilter',
                      leaf: 'createdAt',
                      operator: 'gte',
                      value: new Date('2021-01-01T00:00:00.000Z'),
                    },
                  ],
                },
              ],

              [
                `A conjunction of IN`,
                {
                  AND: [
                    {
                      status_in: [
                        ArticleStatus.DELETED,
                        ArticleStatus.DRAFT,
                        ArticleStatus.PUBLISHED,
                      ],
                    },
                    { status_in: [ArticleStatus.DRAFT] },
                  ],
                },
                {
                  kind: 'LeafFilter',
                  leaf: 'status',
                  operator: 'eq',
                  value: ArticleStatus.DRAFT,
                },
              ],
            ])('%s', (_label, input, filter) => {
              const node = gp.getNodeByName('Article');
              const filterInputType = node.filterInputType;

              expect(
                filterInputType.parseAndFilter(
                  input,
                  undefined,
                  utils.addPath(undefined, filterInputType.name),
                ).filter.ast,
              ).toEqual(filter);
            });
          });

          describe(`Edges`, () => {
            it.each<
              [
                label: string,
                filter: NodeFilterInputValue,
                ast: BooleanFilter['ast'],
              ]
            >([
              [
                'An article WITH any "category" - 0',
                { category_is_null: false },
                {
                  kind: 'EdgeExistsFilter',
                  edge: 'category',
                },
              ],

              [
                'An article WITH any "category" - 1',
                { category_not: null },
                {
                  kind: 'EdgeExistsFilter',
                  edge: 'category',
                },
              ],

              [
                'An article WITH any "category" - 2',
                { category: {} },
                {
                  kind: 'EdgeExistsFilter',
                  edge: 'category',
                },
              ],

              [
                'An article in the specified "category"',
                { category: { slug: 'news' } },
                {
                  kind: 'EdgeExistsFilter',
                  edge: 'category',
                  headFilter: {
                    kind: 'NodeFilter',
                    node: 'Category',
                    filter: {
                      kind: 'LeafFilter',
                      leaf: 'slug',
                      operator: 'eq',
                      value: 'news',
                    },
                  },
                },
              ],

              [
                'An article WITHOUT any "category" - 0',
                { category_is_null: true },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: { kind: 'EdgeExistsFilter', edge: 'category' },
                },
              ],

              [
                'An article WITHOUT any "category" - 1',
                { category: null },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: { kind: 'EdgeExistsFilter', edge: 'category' },
                },
              ],

              [
                'An article WITHOUT any "category" - 2',
                { category_not: {} },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: { kind: 'EdgeExistsFilter', edge: 'category' },
                },
              ],

              [
                'An article not in the specified "category"',
                { category_not: { slug: 'news' } },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: {
                    kind: 'EdgeExistsFilter',
                    edge: 'category',
                    headFilter: {
                      kind: 'NodeFilter',
                      node: 'Category',
                      filter: {
                        kind: 'LeafFilter',
                        leaf: 'slug',
                        operator: 'eq',
                        value: 'news',
                      },
                    },
                  },
                },
              ],

              [
                'AND/Conjunction - 0',
                { AND: [{ category_not: {} }, { category: {} }] },
                { kind: 'BooleanValue', value: false },
              ],

              [
                'AND/Conjunction - 1',
                {
                  AND: [{ category_not: {} }, { category: { slug: 'news' } }],
                },
                { kind: 'BooleanValue', value: false },
              ],

              [
                'AND/Conjunction - 2',
                {
                  AND: [
                    { category_not: { slug: 'news' } },
                    { category: { slug: 'news' } },
                  ],
                },
                { kind: 'BooleanValue', value: false },
              ],

              [
                'OR/Disjunction - 0',
                {
                  OR: [
                    { category: { slug: 'news' } },
                    { category: { slug: 'tv' } },
                  ],
                },
                {
                  kind: 'EdgeExistsFilter',
                  edge: 'category',
                  headFilter: {
                    kind: 'NodeFilter',
                    node: 'Category',
                    filter: {
                      kind: 'LeafFilter',
                      leaf: 'slug',
                      operator: 'in',
                      values: ['news', 'tv'],
                    },
                  },
                },
              ],

              [
                'OR/Disjunction - 1',
                {
                  OR: [{ category: { slug: 'news' } }, { category: {} }],
                },
                {
                  kind: 'EdgeExistsFilter',
                  edge: 'category',
                },
              ],
            ])('%s', (_label, input, filter) => {
              const node = gp.getNodeByName('Article');
              const filterInputType = node.filterInputType;

              expect(
                filterInputType.parseAndFilter(
                  input,
                  undefined,
                  utils.addPath(undefined, filterInputType.name),
                ).filter.ast,
              ).toEqual(filter);
            });
          });
        });

        describe(`Reverse-edges`, () => {
          describe('Unique', () => {
            it.each<
              [
                label: string,
                filter: NodeFilterInputValue,
                ast: BooleanFilter['ast'],
              ]
            >([
              [
                'A user WITH any "profile" - 0',
                { profile_is_null: false },
                {
                  kind: 'ReverseEdgeUniqueExistsFilter',
                  reverseEdge: 'profile',
                },
              ],

              [
                'A user WITH any "profile" - 1',
                { profile_not: null },
                {
                  kind: 'ReverseEdgeUniqueExistsFilter',
                  reverseEdge: 'profile',
                },
              ],

              [
                'A user WITH any "profile" - 1',
                { profile: {} },
                {
                  kind: 'ReverseEdgeUniqueExistsFilter',
                  reverseEdge: 'profile',
                },
              ],

              [
                'An user with the specified "profile"',
                { profile: { birthday_not: null } },
                {
                  kind: 'ReverseEdgeUniqueExistsFilter',
                  reverseEdge: 'profile',
                  headFilter: {
                    kind: 'NodeFilter',
                    node: 'UserProfile',
                    filter: {
                      kind: 'BooleanOperation',
                      operator: 'Not',
                      operand: {
                        kind: 'LeafFilter',
                        leaf: 'birthday',
                        operator: 'eq',
                        value: null,
                      },
                    },
                  },
                },
              ],

              [
                'A user WITHOUT any "profile" - 0',
                { profile_is_null: true },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: {
                    kind: 'ReverseEdgeUniqueExistsFilter',
                    reverseEdge: 'profile',
                  },
                },
              ],

              [
                'A user WITHOUT any "profile" - 1',
                { profile: null },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: {
                    kind: 'ReverseEdgeUniqueExistsFilter',
                    reverseEdge: 'profile',
                  },
                },
              ],

              [
                'A user WITHOUT any "profile" - 1',
                { profile_not: {} },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: {
                    kind: 'ReverseEdgeUniqueExistsFilter',
                    reverseEdge: 'profile',
                  },
                },
              ],

              [
                'A user not having the specified "profile"',
                { profile_not: { birthday_not: null } },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: {
                    kind: 'ReverseEdgeUniqueExistsFilter',
                    reverseEdge: 'profile',
                    headFilter: {
                      kind: 'NodeFilter',
                      node: 'UserProfile',
                      filter: {
                        kind: 'BooleanOperation',
                        operator: 'Not',
                        operand: {
                          kind: 'LeafFilter',
                          leaf: 'birthday',
                          operator: 'eq',
                          value: null,
                        },
                      },
                    },
                  },
                },
              ],

              [
                'AND/Conjunction - 0',
                { AND: [{ profile_not: {} }, { profile: {} }] },
                { kind: 'BooleanValue', value: false },
              ],

              [
                'AND/Conjunction - 1',
                {
                  AND: [
                    { profile_not: { twitterHandle: '@yvannboucher' } },
                    { profile: { twitterHandle: '@yvannboucher' } },
                  ],
                },
                { kind: 'BooleanValue', value: false },
              ],

              [
                'AND/Conjunction - 2',
                {
                  AND: [
                    { profile: { twitterHandle: 'ryanmdahl' } },
                    { profile: { facebookId: 'leeb' } },
                  ],
                },
                {
                  kind: 'ReverseEdgeUniqueExistsFilter',
                  reverseEdge: 'profile',
                  headFilter: {
                    kind: 'NodeFilter',
                    node: 'UserProfile',
                    filter: {
                      kind: 'BooleanOperation',
                      operator: 'And',
                      operands: [
                        {
                          kind: 'LeafFilter',
                          leaf: 'twitterHandle',
                          operator: 'eq',
                          value: 'ryanmdahl',
                        },
                        {
                          kind: 'LeafFilter',
                          leaf: 'facebookId',
                          operator: 'eq',
                          value: 'leeb',
                        },
                      ],
                    },
                  },
                },
              ],

              [
                'OR/Disjunction - 0',
                {
                  OR: [
                    { profile: { twitterHandle: 'ryanmdahl' } },
                    { profile: { twitterHandle: 'leeb' } },
                  ],
                },
                {
                  kind: 'ReverseEdgeUniqueExistsFilter',
                  reverseEdge: 'profile',
                  headFilter: {
                    kind: 'NodeFilter',
                    node: 'UserProfile',
                    filter: {
                      kind: 'LeafFilter',
                      leaf: 'twitterHandle',
                      operator: 'in',
                      values: ['ryanmdahl', 'leeb'],
                    },
                  },
                },
              ],

              [
                'OR/Disjunction - 1',
                {
                  OR: [
                    { profile: { twitterHandle: 'ryanmdahl' } },
                    { profile: {} },
                  ],
                },
                {
                  kind: 'ReverseEdgeUniqueExistsFilter',
                  reverseEdge: 'profile',
                },
              ],
            ])('%s', (_label, input, filter) => {
              const node = gp.getNodeByName('User');
              const filterInputType = node.filterInputType;

              expect(
                filterInputType.parseAndFilter(
                  input,
                  undefined,
                  utils.addPath(undefined, filterInputType.name),
                ).filter.ast,
              ).toEqual(filter);
            });
          });

          describe('Multiple', () => {
            it.each<
              [
                label: string,
                filter: NodeFilterInputValue,
                ast: BooleanFilter['ast'],
              ]
            >([
              [
                'An article WITH some "tags"',
                { tags_some: {} },
                {
                  kind: 'ReverseEdgeMultipleExistsFilter',
                  reverseEdge: 'tags',
                },
              ],

              [
                'An article WITHOUT any deprecated "tags" - 0',
                { tags_none: { tag: { deprecated: true } } },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: {
                    kind: 'ReverseEdgeMultipleExistsFilter',
                    reverseEdge: 'tags',
                    headFilter: {
                      kind: 'NodeFilter',
                      node: 'ArticleTag',
                      filter: {
                        kind: 'EdgeExistsFilter',
                        edge: 'tag',
                        headFilter: {
                          kind: 'NodeFilter',
                          node: 'Tag',
                          filter: {
                            kind: 'LeafFilter',
                            leaf: 'deprecated',
                            operator: 'eq',
                            value: true,
                          },
                        },
                      },
                    },
                  },
                },
              ],

              [
                'An article WITHOUT any deprecated "tags" - 1',
                {
                  tags_every: {
                    tag: { OR: [{ deprecated: null }, { deprecated: false }] },
                  },
                },
                {
                  kind: 'BooleanOperation',
                  operator: 'Not',
                  operand: {
                    kind: 'ReverseEdgeMultipleExistsFilter',
                    reverseEdge: 'tags',
                    headFilter: {
                      kind: 'NodeFilter',
                      node: 'ArticleTag',
                      filter: {
                        kind: 'BooleanOperation',
                        operator: 'Not',
                        operand: {
                          kind: 'EdgeExistsFilter',
                          edge: 'tag',
                          headFilter: {
                            kind: 'NodeFilter',
                            node: 'Tag',
                            filter: {
                              kind: 'LeafFilter',
                              leaf: 'deprecated',
                              operator: 'in',
                              values: [null, false],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            ])('%s', (_label, input, filter) => {
              const node = gp.getNodeByName('Article');
              const filterInputType = node.filterInputType;

              expect(
                filterInputType.parseAndFilter(
                  input,
                  undefined,
                  utils.addPath(undefined, filterInputType.name),
                ).filter.ast,
              ).toEqual(filter);
            });
          });
        });

        describe('Complexes', () => {
          it.each<
            [
              label: string,
              filter: NodeFilterInputValue,
              ast: BooleanFilter['ast'],
            ]
          >([
            [
              'A complex "OR"',
              {
                OR: [
                  { _id: 1 },
                  { _id_not: 20 },
                  { category: null },
                  { status: ArticleStatus.DELETED },
                  { category: { slug: 'news' } },
                  { _id_in: [2] },
                  { category_is_null: true },
                  { _id_in: 3 },
                  { status: ArticleStatus.DRAFT },
                  { _id_in: [4, 5, 4, 3, 2, 1] },
                  { category: { slug: 'tv' } },
                ],
              },
              {
                kind: 'BooleanOperation',
                operator: 'Or',
                operands: [
                  {
                    kind: 'BooleanOperation',
                    operator: 'Not',
                    operand: {
                      kind: 'LeafFilter',
                      leaf: '_id',
                      operator: 'eq',
                      value: 20,
                    },
                  },
                  {
                    kind: 'BooleanOperation',
                    operator: 'Not',
                    operand: {
                      kind: 'EdgeExistsFilter',
                      edge: 'category',
                    },
                  },
                  {
                    kind: 'LeafFilter',
                    leaf: 'status',
                    operator: 'in',
                    values: ['deleted', 'draft'],
                  },
                  {
                    kind: 'EdgeExistsFilter',
                    edge: 'category',
                    headFilter: {
                      kind: 'NodeFilter',
                      node: 'Category',
                      filter: {
                        kind: 'LeafFilter',
                        leaf: 'slug',
                        operator: 'in',
                        values: ['news', 'tv'],
                      },
                    },
                  },
                  {
                    kind: 'LeafFilter',
                    leaf: '_id',
                    operator: 'in',
                    values: [1, 2, 4, 5, 3],
                  },
                ],
              },
            ],

            [
              'A complex "AND"',
              {
                AND: [
                  { NOT: { _id: 1 } },
                  { _id_not: 2 },
                  { category: { slug_in: ['news', 'home'] } },
                  { NOT: { _id: 3 } },
                  { _id_not_in: [4, 5, 6] },
                  { category: { slug_in: ['news', 'tv', 'home'] } },
                ],
              },
              {
                kind: 'BooleanOperation',
                operator: 'And',
                operands: [
                  {
                    kind: 'EdgeExistsFilter',
                    edge: 'category',
                    headFilter: {
                      kind: 'NodeFilter',
                      node: 'Category',
                      filter: {
                        kind: 'LeafFilter',
                        leaf: 'slug',
                        operator: 'in',
                        values: ['news', 'home'],
                      },
                    },
                  },
                  {
                    kind: 'BooleanOperation',
                    operator: 'Not',
                    operand: {
                      kind: 'LeafFilter',
                      leaf: '_id',
                      operator: 'in',
                      values: [1, 2, 4, 5, 6, 3],
                    },
                  },
                ],
              },
            ],
          ])('%s', (_label, input, filter) => {
            const node = gp.getNodeByName('Article');
            const filterInputType = node.filterInputType;

            expect(
              filterInputType.parseAndFilter(
                input,
                undefined,
                utils.addPath(undefined, filterInputType.name),
              ).filter.ast,
            ).toEqual(filter);
          });
        });
      });
    });
  });
});
