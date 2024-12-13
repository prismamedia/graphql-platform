import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { inspect } from 'node:util';
import * as R from 'remeda';
import {
  ArticleStatus,
  MyGP,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { GraphQLPlatform } from '../../../index.js';
import { NodeFilterInputType, type NodeFilterInputValue } from './filter.js';

describe('NodeFilterInputType', () => {
  let gp: MyGP;

  before(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    nodeNames.forEach((nodeName) => {
      it(`${nodeName} has a filter input type`, ({ assert: { snapshot } }) => {
        const node = gp.getNodeByName(nodeName);

        const filterInputType = node.filterInputType;
        assert(filterInputType instanceof NodeFilterInputType);

        if (node.isPublic()) {
          assert(
            filterInputType.getGraphQLInputType() instanceof
              graphql.GraphQLInputObjectType,
          );

          snapshot(graphql.printType(filterInputType.getGraphQLInputType()));
        } else {
          assert.throws(() => filterInputType.getGraphQLInputType(), {
            message: `The "${nodeName}FilterInput" input type is private`,
          });
        }
      });
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      (
        [
          [
            'Article',
            { id_is_null: true },
            'Expects not to contain the extra key(s): id_is_null',
          ],
          [
            'Article',
            { id: null },
            '/id - Expects a non-null "UUIDv4", got: null',
          ],
          ['Article', { id: 123 }, `/id - Expects an "UUIDv4", got: 123`],
          [
            'Article',
            { category: { parent: { title: null } } },
            '/category/parent/title - Expects a non-null "NonEmptyTrimmedString", got: null',
          ],
        ] as const
      ).forEach(([nodeName, input, error]) => {
        it(`${nodeName}FilterInput.parseAndFilter(${inspect(input, undefined, 5)}) throws an error`, () => {
          const node = gp.getNodeByName(nodeName);
          const filterInputType = node.filterInputType;

          assert.throws(() => filterInputType.parseAndFilter(input), {
            message: error,
          });
        });
      });

      it('throws an UnauthorizedError', { todo: true }, () => {});
    });

    describe(`Works`, () => {
      describe(`Reduces to FALSE`, () => {
        // These filters return FALSE
        [
          null,
          { NOT: {} },
          { AND: [null] },
          { OR: [] },
          { OR: [null] },
          { id_in: [] },
          { category: { OR: [] } },
        ].forEach((input) => {
          it(`ArticleFilterInput.filter(${inspect(input, undefined, 5)}) = FALSE`, () => {
            const node = gp.getNodeByName('Article');
            const filterInputType = node.filterInputType;

            assert(
              filterInputType
                .parseAndFilter(
                  input,
                  undefined,
                  utils.addPath(undefined, filterInputType.name),
                )
                .isFalse(),
            );
          });
        });
      });

      describe(`Reduces to TRUE`, () => {
        // These filters return TRUE
        [
          undefined,
          {},
          { NOT: null },
          { AND: [] },
          { AND: [undefined] },
          { AND: [{}] },
          { OR: [undefined] },
          { OR: [{}] },
          { id_not_in: [] },
        ].forEach((input) => {
          it(`ArticleFilterInput.filter(${inspect(input, undefined, 5)}) = TRUE`, () => {
            const node = gp.getNodeByName('Article');
            const filterInputType = node.filterInputType;

            assert(filterInputType.parseAndFilter(input).isTrue());
          });
        });

        it(`ArticleExtensionFilterInput.filter({ article: {} }) = TRUE`, () => {
          const node = gp.getNodeByName('ArticleExtension');
          const filterInputType = node.filterInputType;

          assert(filterInputType.parseAndFilter({ article: {} }).isTrue());
        });
      });

      describe('Components', () => {
        describe(`Leafs`, () => {
          (
            [
              [
                `Idempotent law`,
                [
                  ['OR', { _id_in: [1, 2, 3, 2, 1] }, { _id_in: [1, 2, 3] }],
                  ['AND', { AND: [{ _id: 1 }, { _id: 1 }] }, { _id: 1 }],
                  [
                    'AND & OR',
                    {
                      AND: [{ _id_in: [1, 2, 3, 4] }, { _id_in: [2, 3, 4, 1] }],
                      OR: [{ _id_in: [3, 4, 1, 2] }, { _id_in: [4, 1, 2, 3] }],
                    },
                    { _id_in: [1, 2, 3, 4] },
                  ],
                ],
              ],
              [
                `Absorption law`,
                [
                  [
                    'OR',
                    {
                      OR: [
                        { _id: 1 },
                        {
                          AND: [
                            { _id: 1 },
                            { status: ArticleStatus.PUBLISHED },
                          ],
                        },
                      ],
                    },
                    { _id: 1 },
                  ],
                  [
                    'AND',
                    {
                      AND: [
                        { _id: 1 },
                        {
                          OR: [{ _id: 1 }, { status: ArticleStatus.PUBLISHED }],
                        },
                      ],
                    },
                    { _id: 1 },
                  ],
                ],
              ],
              [
                'Complementation',
                [
                  ['OR', { OR: [{ _id: 5 }, { _id_not: 5 }] }, {}],
                  ['AND', { AND: [{ _id: 5 }, { _id_not: 5 }] }, null],
                ],
              ],
              [
                'Comparison - AND',
                Object.entries({
                  eq: {
                    eq: [
                      [5, 4, null],
                      [5, 5, { _id: 5 }],
                      [5, 6, null],
                    ],
                    not: [
                      [5, 4, { _id: 5 }],
                      [5, 5, null],
                      [5, 6, { _id: 5 }],
                    ],
                    gt: [
                      [5, 4, { _id: 5 }],
                      [5, 5, null],
                      [5, 6, null],
                    ],
                    gte: [
                      [5, 4, { _id: 5 }],
                      [5, 5, { _id: 5 }],
                      [5, 6, null],
                    ],
                    lt: [
                      [5, 4, null],
                      [5, 5, null],
                      [5, 6, { _id: 5 }],
                    ],
                    lte: [
                      [5, 4, null],
                      [5, 5, { _id: 5 }],
                      [5, 6, { _id: 5 }],
                    ],
                  },
                  gt: {
                    gt: [
                      [5, 4, { _id_gt: 5 }],
                      [5, 5, { _id_gt: 5 }],
                      [5, 6, { _id_gt: 6 }],
                    ],
                    gte: [
                      [5, 4, { _id_gt: 5 }],
                      [5, 5, { _id_gt: 5 }],
                      [5, 6, { _id_gte: 6 }],
                    ],
                    lt: [
                      [5, 4, null],
                      [5, 5, null],
                      [5, 6, { _id_gt: 5, _id_lt: 6 }],
                    ],
                    lte: [
                      [5, 4, null],
                      [5, 5, null],
                      [5, 6, { _id_gt: 5, _id_lte: 6 }],
                    ],
                  },
                  gte: {
                    gte: [
                      [5, 4, { _id_gte: 5 }],
                      [5, 5, { _id_gte: 5 }],
                      [5, 6, { _id_gte: 6 }],
                    ],
                    lt: [
                      [5, 4, null],
                      [5, 5, null],
                      [5, 6, { _id_gte: 5, _id_lt: 6 }],
                    ],
                    lte: [
                      [5, 4, null],
                      [5, 5, { _id: 5 }],
                      [5, 6, { _id_gte: 5, _id_lte: 6 }],
                    ],
                  },
                  lt: {
                    lt: [
                      [5, 4, { _id_lt: 4 }],
                      [5, 5, { _id_lt: 5 }],
                      [5, 6, { _id_lt: 5 }],
                    ],
                    lte: [
                      [5, 4, { _id_lte: 4 }],
                      [5, 5, { _id_lt: 5 }],
                      [5, 6, { _id_lt: 5 }],
                    ],
                  },
                  lte: {
                    lte: [
                      [5, 4, { _id_lte: 4 }],
                      [5, 5, { _id_lte: 5 }],
                      [5, 6, { _id_lte: 5 }],
                    ],
                  },
                } as const).flatMap<
                  [
                    label: string,
                    input: NodeFilterInputValue,
                    output: NodeFilterInputValue,
                  ]
                >(([aOperator, config]) =>
                  Object.entries(config).flatMap(([bOperator, values]) =>
                    values.map(([aValue, bValue, output]: any): any => [
                      `${aOperator}-${aValue} AND ${bOperator}-${bValue}`,
                      {
                        AND: [
                          {
                            [`_id${aOperator === 'eq' ? '' : `_${aOperator}`}`]:
                              aValue,
                          },
                          {
                            [`_id${bOperator === 'eq' ? '' : `_${bOperator}`}`]:
                              bValue,
                          },
                        ],
                      },
                      output,
                    ]),
                  ),
                ),
              ],
              [
                'Comparison - OR',
                Object.entries({
                  eq: {
                    eq: [
                      [5, 4, { _id_in: [5, 4] }],
                      [5, 5, { _id: 5 }],
                      [5, 6, { _id_in: [5, 6] }],
                    ],
                    not: [
                      [5, 4, { _id_not: 4 }],
                      [5, 5, {}],
                      [5, 6, { _id_not: 6 }],
                    ],
                    gt: [
                      [5, 4, { _id_gt: 4 }],
                      [5, 5, { _id_gte: 5 }],
                      [5, 6, { OR: [{ _id: 5 }, { _id_gt: 6 }] }],
                    ],
                    gte: [
                      [5, 4, { _id_gte: 4 }],
                      [5, 5, { _id_gte: 5 }],
                      [5, 6, { OR: [{ _id: 5 }, { _id_gte: 6 }] }],
                    ],
                    lt: [
                      [5, 4, { OR: [{ _id: 5 }, { _id_lt: 4 }] }],
                      [5, 5, { _id_lte: 5 }],
                      [5, 6, { _id_lt: 6 }],
                    ],
                    lte: [
                      [5, 4, { OR: [{ _id: 5 }, { _id_lte: 4 }] }],
                      [5, 5, { _id_lte: 5 }],
                      [5, 6, { _id_lte: 6 }],
                    ],
                  },
                  gt: {
                    gt: [
                      [5, 4, { _id_gt: 4 }],
                      [5, 5, { _id_gt: 5 }],
                      [5, 6, { _id_gt: 5 }],
                    ],
                    gte: [
                      [5, 4, { _id_gte: 4 }],
                      [5, 5, { _id_gte: 5 }],
                      [5, 6, { _id_gt: 5 }],
                    ],
                    lt: [
                      [5, 4, { OR: [{ _id_gt: 5 }, { _id_lt: 4 }] }],
                      [5, 5, { _id_not: 5 }],
                      [5, 6, {}],
                    ],
                    lte: [
                      [5, 4, { OR: [{ _id_gt: 5 }, { _id_lte: 4 }] }],
                      [5, 5, {}],
                      [5, 6, {}],
                    ],
                  },
                  gte: {
                    gte: [
                      [5, 4, { _id_gte: 4 }],
                      [5, 5, { _id_gte: 5 }],
                      [5, 6, { _id_gte: 5 }],
                    ],
                    lt: [
                      [5, 4, { OR: [{ _id_gte: 5 }, { _id_lt: 4 }] }],
                      [5, 5, {}],
                      [5, 6, {}],
                    ],
                    lte: [
                      [5, 4, { OR: [{ _id_gte: 5 }, { _id_lte: 4 }] }],
                      [5, 5, {}],
                      [5, 6, {}],
                    ],
                  },
                  lt: {
                    lt: [
                      [5, 4, { _id_lt: 5 }],
                      [5, 5, { _id_lt: 5 }],
                      [5, 6, { _id_lt: 6 }],
                    ],
                    lte: [
                      [5, 4, { _id_lt: 5 }],
                      [5, 5, { _id_lte: 5 }],
                      [5, 6, { _id_lte: 6 }],
                    ],
                  },
                  lte: {
                    lte: [
                      [5, 4, { _id_lte: 5 }],
                      [5, 5, { _id_lte: 5 }],
                      [5, 6, { _id_lte: 6 }],
                    ],
                  },
                } as const).flatMap<
                  [
                    label: string,
                    input: NodeFilterInputValue,
                    output: NodeFilterInputValue,
                  ]
                >(([aOperator, config]) =>
                  Object.entries(config).flatMap(([bOperator, values]) =>
                    values.map(([aValue, bValue, output]: any): any => [
                      `${aOperator}-${aValue} OR ${bOperator}-${bValue}`,
                      {
                        OR: [
                          {
                            [`_id${aOperator === 'eq' ? '' : `_${aOperator}`}`]:
                              aValue,
                          },
                          {
                            [`_id${bOperator === 'eq' ? '' : `_${bOperator}`}`]:
                              bValue,
                          },
                        ],
                      },
                      output,
                    ]),
                  ),
                ),
              ],
              [
                'IN-0-5-10 - AND',
                [
                  [
                    'IN-5-10',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_in: [5, 10] }] },
                    { _id_in: [5, 10] },
                  ],
                  [
                    'IN-4-6',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_in: [4, 6] }] },
                    null,
                  ],
                  ['EQ-4', { AND: [{ _id_in: [0, 5, 10] }, { _id: 4 }] }, null],
                  [
                    'EQ-5',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id: 5 }] },
                    { _id: 5 },
                  ],
                  [
                    'NOT-4',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_not: 4 }] },
                    { _id_in: [0, 5, 10] },
                  ],
                  [
                    'NOT-5',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_not: 5 }] },
                    { _id_in: [0, 10] },
                  ],
                  [
                    'GT-0',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_gt: 0 }] },
                    { _id_in: [5, 10] },
                  ],
                  [
                    'GT-5',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_gt: 5 }] },
                    { _id: 10 },
                  ],
                  [
                    'GT-10',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_gt: 10 }] },
                    null,
                  ],
                  [
                    'GTE-0',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_gte: 0 }] },
                    { _id_in: [0, 5, 10] },
                  ],
                  [
                    'GTE-5',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_gte: 5 }] },
                    { _id_in: [5, 10] },
                  ],
                  [
                    'GTE-10',
                    { AND: [{ _id_in: [0, 5, 10] }, { _id_gte: 10 }] },
                    { _id: 10 },
                  ],
                ],
              ],
              [
                'IN - OR',
                [
                  [
                    'IN-5-10',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_in: [5, 10] }] },
                    { _id_in: [0, 5, 10] },
                  ],
                  [
                    'OR-4-6',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_in: [4, 6] }] },
                    { _id_in: [0, 5, 10, 4, 6] },
                  ],
                  [
                    'EQ-4',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id: 4 }] },
                    { _id_in: [0, 5, 10, 4] },
                  ],
                  [
                    'EQ-5',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id: 5 }] },
                    { _id_in: [0, 5, 10] },
                  ],
                  [
                    'NOT-4',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_not: 4 }] },
                    { _id_not: 4 },
                  ],
                  [
                    'NOT-5',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_not: 5 }] },
                    {},
                  ],
                  [
                    'GT-0',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_gt: 0 }] },
                    { _id_gte: 0 },
                  ],
                  [
                    'GT-5',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_gt: 5 }] },
                    { OR: [{ _id_in: [0, 5] }, { _id_gt: 5 }] },
                  ],
                  [
                    'GT-10',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_gt: 10 }] },
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_gt: 10 }] },
                  ],
                  [
                    'GTE-0',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_gte: 0 }] },
                    { _id_gte: 0 },
                  ],
                  [
                    'GTE-5',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_gte: 5 }] },
                    { OR: [{ _id: 0 }, { _id_gte: 5 }] },
                  ],
                  [
                    'GTE-10',
                    { OR: [{ _id_in: [0, 5, 10] }, { _id_gte: 10 }] },
                    { OR: [{ _id_in: [0, 5] }, { _id_gte: 10 }] },
                  ],
                ],
              ],
              [
                'Others',
                [
                  [
                    `A simple logical "AND" filter over some leaves' value`,
                    {
                      id: '94de8a4b-a25f-4659-ba13-c84761ef135b',
                      title_contains: 'FRANCE',
                      createdAt_gte: '2021-01-01T00:00:00Z',
                    },
                    {
                      id: '94de8a4b-a25f-4659-ba13-c84761ef135b',
                      title_contains: 'FRANCE',
                      createdAt_gte: new Date('2021-01-01T00:00:00.000Z'),
                    },
                  ],
                ],
              ],
            ] as [
              label: string,
              tests?: [
                label: string,
                input: NodeFilterInputValue,
                output: NodeFilterInputValue,
              ][],
            ][]
          ).forEach(([label, tests]) => {
            describe(label, () => {
              tests?.forEach(([label, input, output]) => {
                it(label, () => {
                  assert.deepEqual(
                    gp
                      .getNodeByName('Article')
                      .filterInputType.parseAndFilter(input).filter.inputValue,
                    output,
                  );
                });
              });
            });
          });
        });

        describe(`Edges`, () => {
          (
            [
              [
                'An article WITH any "category" - 0',
                { category_not: null },
                { category: {} },
              ],

              [
                'An article WITH any "category" - 1',
                { category: {} },
                { category: {} },
              ],

              [
                'An article in the specified "category"',
                { category: { slug: 'news' } },
                { category: { slug: 'news' } },
              ],

              [
                'An article WITHOUT any "category" - 0',
                { category_is_null: true },
                { NOT: { category: {} } },
              ],

              [
                'An article WITHOUT any "category" - 1',
                { category: null },
                { NOT: { category: {} } },
              ],

              [
                'An article WITHOUT any "category" - 2',
                { category_not: {} },
                { NOT: { category: {} } },
              ],

              [
                'An article not in the specified "category"',
                { category_not: { slug: 'news' } },
                { NOT: { category: { slug: 'news' } } },
              ],

              [
                'AND - 0',
                { AND: [{ category_not: {} }, { category: {} }] },
                null,
              ],

              [
                'AND - 1',
                {
                  AND: [{ category_not: {} }, { category: { slug: 'news' } }],
                },
                null,
              ],

              [
                'AND - 2',
                {
                  AND: [
                    { category_not: { slug: 'news' } },
                    { category: { slug: 'news' } },
                  ],
                },
                null,
              ],

              [
                'OR - 0',
                {
                  OR: [
                    { category: { slug: 'news' } },
                    { category: { slug: 'tv' } },
                  ],
                },
                { category: { slug_in: ['news', 'tv'] } },
              ],

              [
                'OR - 1',
                {
                  OR: [{ category: { slug: 'news' } }, { category: {} }],
                },
                { category: {} },
              ],
            ] as [
              label: string,
              input: NodeFilterInputValue,
              output: NodeFilterInputValue,
            ][]
          ).forEach(([label, input, output]) => {
            it(label, () => {
              assert.deepEqual(
                gp
                  .getNodeByName('Article')
                  .filterInputType.parseAndFilter(input).filter.inputValue,
                output,
              );
            });
          });
        });
      });

      describe(`Reverse-edges`, () => {
        describe('Unique', () => {
          (
            [
              [
                'A user WITH any "profile" - 0',
                { profile_is_null: false },
                { profile: {} },
              ],

              [
                'A user WITH any "profile" - 1',
                { profile_not: null },
                { profile: {} },
              ],

              [
                'A user WITH any "profile" - 2',
                { profile: {} },
                { profile: {} },
              ],

              [
                'An user with the specified "profile"',
                { profile: { birthday_not: null } },
                { profile: { birthday_not: null } },
              ],

              [
                'A user WITHOUT any "profile" - 0',
                { profile_is_null: true },
                { NOT: { profile: {} } },
              ],

              [
                'A user WITHOUT any "profile" - 1',
                { profile: null },
                { NOT: { profile: {} } },
              ],

              [
                'A user WITHOUT any "profile" - 2',
                { profile_not: {} },
                { NOT: { profile: {} } },
              ],

              [
                'A user not having the specified "profile"',
                { profile_not: { birthday_not: null } },
                { NOT: { profile: { birthday_not: null } } },
              ],

              [
                'AND - 0',
                { AND: [{ profile_not: {} }, { profile: {} }] },
                null,
              ],

              [
                'AND - 1',
                {
                  AND: [
                    { profile_not: { twitterHandle: '@yvannboucher' } },
                    { profile: { twitterHandle: '@yvannboucher' } },
                  ],
                },
                null,
              ],

              [
                'AND - 2',
                {
                  AND: [
                    { profile: { twitterHandle: 'ryanmdahl' } },
                    { profile: { facebookId: 'leeb' } },
                  ],
                },
                { profile: { twitterHandle: 'ryanmdahl', facebookId: 'leeb' } },
              ],

              [
                'OR - 0',
                {
                  OR: [
                    { profile: { twitterHandle: 'ryanmdahl' } },
                    { profile: { twitterHandle: 'leeb' } },
                  ],
                },
                { profile: { twitterHandle_in: ['ryanmdahl', 'leeb'] } },
              ],

              [
                'OR - 1',
                {
                  OR: [
                    { profile: { twitterHandle: 'ryanmdahl' } },
                    { profile: {} },
                  ],
                },
                { profile: {} },
              ],
            ] as [
              label: string,
              input: NodeFilterInputValue,
              output: NodeFilterInputValue,
            ][]
          ).forEach(([label, input, output]) => {
            it(label, () => {
              assert.deepEqual(
                gp.getNodeByName('User').filterInputType.parseAndFilter(input)
                  .filter.inputValue,
                output,
              );
            });
          });
        });

        describe('Multiple', () => {
          (
            [
              [
                'An article WITH some "tags"',
                { tags_some: {} },
                { tags_some: {} },
              ],

              [
                'An article WITHOUT any deprecated "tags" - 0',
                { tags_none: { tag: { deprecated: true } } },
                {
                  NOT: {
                    tags_some: { tag: { deprecated: true } },
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
                  NOT: {
                    tags_some: {
                      NOT: { tag: { deprecated_in: [null, false] } },
                    },
                  },
                },
              ],

              [
                'An article WITH a specified tag OR another specified tag',
                {
                  OR: [
                    {
                      tags_some: {
                        article: { _id: 5 },
                        tag: { id: 'ef31efed-361c-449c-a561-ed94eabbf60d' },
                      },
                    },
                    {
                      tags_some: {
                        article: { _id: 6 },
                        tag: { id: 'ef31efed-361c-449c-a561-ed94eabbf60d' },
                      },
                    },
                  ],
                },
                {
                  tags_some: {
                    article: { _id_in: [5, 6] },
                    tag: { id: 'ef31efed-361c-449c-a561-ed94eabbf60d' },
                  },
                },
              ],
            ] as [
              label: string,
              input: NodeFilterInputValue,
              output: NodeFilterInputValue,
            ][]
          ).forEach(([label, input, output]) => {
            it(label, () => {
              assert.deepEqual(
                gp
                  .getNodeByName('Article')
                  .filterInputType.parseAndFilter(input).filter.inputValue,
                output,
              );
            });
          });
        });
      });

      describe('Others', () => {
        (
          [
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
                OR: [
                  { _id_not: 20 },
                  { status_in: [ArticleStatus.DELETED, ArticleStatus.DRAFT] },
                  { NOT: { category: { NOT: { slug_in: ['tv', 'news'] } } } },
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
                category: { slug_in: ['news', 'home'] },
                NOT: { _id_in: [1, 2, 3, 4, 5, 6] },
              },
            ],

            [
              'An "IN" with lot of values',
              {
                OR: [{ _id: 1 }, { _id_in: R.range(2, 1000) }],
              },
              { _id_in: [...R.range(2, 1000), 1] },
            ],
          ] as [
            label: string,
            input: NodeFilterInputValue,
            output: NodeFilterInputValue,
          ][]
        ).forEach(([label, input, output]) => {
          it(label, () => {
            assert.deepEqual(
              gp.getNodeByName('Article').filterInputType.parseAndFilter(input)
                .filter.inputValue,
              output,
            );
          });
        });

        it('A big conjunction', () => {
          const node = gp.getNodeByName('ArticleTag');
          const items = Array(2500);

          assert.deepEqual(
            node.filterInputType.parseAndFilter({
              AND: Array.from(items, (_, i) => ({
                OR: [
                  { article: { _id: i } },
                  { tag: { id: '0f9131ff-e615-4a7a-ab9a-57c2032aaf6c' } },
                ],
              })),
            }).inputValue,
            { tag: { id: '0f9131ff-e615-4a7a-ab9a-57c2032aaf6c' } },
          );
        });

        it('A big disjunction', () => {
          const node = gp.getNodeByName('ArticleTag');
          const items = Array(2500);

          assert.deepEqual(
            node.filterInputType.parseAndFilter({
              OR: Array.from(items, (_, i) => ({
                article: { _id: i },
                tag: {
                  id:
                    i % 2
                      ? '4085cf1e-188a-44c9-b053-1ffaa838eb16'
                      : '0f9131ff-e615-4a7a-ab9a-57c2032aaf6c',
                },
              })),
            }).inputValue,
            {
              OR: [
                {
                  article: {
                    _id_in: Array.from(items, (_, i) => i).filter(
                      (i) => !(i % 2),
                    ),
                  },
                  tag: { id: '0f9131ff-e615-4a7a-ab9a-57c2032aaf6c' },
                },
                {
                  article: {
                    _id_in: Array.from(items, (_, i) => i).filter((i) => i % 2),
                  },
                  tag: { id: '4085cf1e-188a-44c9-b053-1ffaa838eb16' },
                },
              ],
            },
          );
        });
      });
    });
  });
});
