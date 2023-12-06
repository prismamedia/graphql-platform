import { beforeAll, describe, expect, it } from '@jest/globals';
import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';
import * as R from 'remeda';
import {
  ArticleStatus,
  MyGP,
  nodeNames,
  nodes,
} from '../../../__tests__/config.js';
import { GraphQLPlatform } from '../../../index.js';
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

      describe('Components', () => {
        describe(`Leafs`, () => {
          describe.each<
            [
              label: string,
              tests?: [
                label: string,
                input: NodeFilterInputValue,
                ast: BooleanFilter['ast'],
              ][],
            ]
          >([
            [
              `Idempotent law`,
              [
                [
                  'OR',
                  { _id_in: [1, 2, 3, 2, 1] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: [1, 2, 3],
                  },
                ],
                [
                  'AND',
                  { AND: [{ _id: 1 }, { _id: 1 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'EQ',
                    value: 1,
                  },
                ],
                [
                  'AND & OR',
                  {
                    AND: [{ _id_in: [1, 2, 3, 4] }, { _id_in: [2, 3, 4, 1] }],
                    OR: [{ _id_in: [3, 4, 1, 2] }, { _id_in: [4, 1, 2, 3] }],
                  },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: [1, 2, 3, 4],
                  },
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
                        AND: [{ _id: 1 }, { status: ArticleStatus.PUBLISHED }],
                      },
                    ],
                  },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'EQ',
                    value: 1,
                  },
                ],
                [
                  'AND',
                  {
                    AND: [
                      { _id: 1 },
                      { OR: [{ _id: 1 }, { status: ArticleStatus.PUBLISHED }] },
                    ],
                  },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'EQ',
                    value: 1,
                  },
                ],
              ],
            ],
            [
              'Complementation',
              [
                [
                  'OR',
                  { OR: [{ _id: 5 }, { _id_not: 5 }] },
                  {
                    kind: 'BOOLEAN',
                    value: true,
                  },
                ],
                [
                  'AND',
                  { AND: [{ _id: 5 }, { _id_not: 5 }] },
                  {
                    kind: 'BOOLEAN',
                    value: false,
                  },
                ],
              ],
            ],
            [
              'Comparison - AND',
              Object.entries({
                eq: {
                  eq: [
                    [5, 4, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      5,
                      { kind: 'LEAF', leaf: '_id', operator: 'EQ', value: 5 },
                    ],
                    [5, 6, { kind: 'BOOLEAN', value: false }],
                  ],
                  not: [
                    [
                      5,
                      4,
                      { kind: 'LEAF', leaf: '_id', operator: 'EQ', value: 5 },
                    ],
                    [5, 5, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      6,
                      { kind: 'LEAF', leaf: '_id', operator: 'EQ', value: 5 },
                    ],
                  ],
                  gt: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 5,
                      },
                    ],
                    [5, 5, { kind: 'BOOLEAN', value: false }],
                    [5, 6, { kind: 'BOOLEAN', value: false }],
                  ],
                  gte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 5,
                      },
                    ],
                    [5, 6, { kind: 'BOOLEAN', value: false }],
                  ],
                  lt: [
                    [5, 4, { kind: 'BOOLEAN', value: false }],
                    [5, 5, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 5,
                      },
                    ],
                  ],
                  lte: [
                    [5, 4, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 5,
                      },
                    ],
                  ],
                },
                gt: {
                  gt: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 6,
                      },
                    ],
                  ],
                  gte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 6,
                      },
                    ],
                  ],
                  lt: [
                    [5, 4, { kind: 'BOOLEAN', value: false }],
                    [5, 5, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      6,
                      {
                        kind: 'AND',
                        operands: expect.arrayContaining([
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GT',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LT',
                            value: 6,
                          },
                        ]),
                      },
                    ],
                  ],
                  lte: [
                    [5, 4, { kind: 'BOOLEAN', value: false }],
                    [5, 5, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      6,
                      {
                        kind: 'AND',
                        operands: expect.arrayContaining([
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GT',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LTE',
                            value: 6,
                          },
                        ]),
                      },
                    ],
                  ],
                },
                gte: {
                  gte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 6,
                      },
                    ],
                  ],
                  lt: [
                    [5, 4, { kind: 'BOOLEAN', value: false }],
                    [5, 5, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      6,
                      {
                        kind: 'AND',
                        operands: expect.arrayContaining([
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GTE',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LT',
                            value: 6,
                          },
                        ]),
                      },
                    ],
                  ],
                  lte: [
                    [5, 4, { kind: 'BOOLEAN', value: false }],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'AND',
                        operands: expect.arrayContaining([
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GTE',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LTE',
                            value: 6,
                          },
                        ]),
                      },
                    ],
                  ],
                },
                lt: {
                  lt: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 5,
                      },
                    ],
                  ],
                  lte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 5,
                      },
                    ],
                  ],
                },
                lte: {
                  lte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 5,
                      },
                    ],
                  ],
                },
              } as const).flatMap<
                [
                  label: string,
                  input: NodeFilterInputValue,
                  ast: BooleanFilter['ast'],
                ]
              >(([aOperator, config]) =>
                Object.entries(config).flatMap(([bOperator, values]) =>
                  values.map(([aValue, bValue, ast]: any): any => [
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
                    ast,
                  ]),
                ),
              ),
            ],
            [
              'Comparison - OR',
              Object.entries({
                eq: {
                  eq: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'IN',
                        values: [5, 4],
                      },
                    ],
                    [
                      5,
                      5,
                      { kind: 'LEAF', leaf: '_id', operator: 'EQ', value: 5 },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'IN',
                        values: [5, 6],
                      },
                    ],
                  ],
                  not: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'NOT',
                        value: 4,
                      },
                    ],
                    [5, 5, { kind: 'BOOLEAN', value: true }],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'NOT',
                        value: 6,
                      },
                    ],
                  ],
                  gt: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'OR',
                        operands: [
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'EQ',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GT',
                            value: 6,
                          },
                        ],
                      },
                    ],
                  ],
                  gte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'OR',
                        operands: [
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'EQ',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GTE',
                            value: 6,
                          },
                        ],
                      },
                    ],
                  ],
                  lt: [
                    [
                      5,
                      4,
                      {
                        kind: 'OR',
                        operands: [
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'EQ',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LT',
                            value: 4,
                          },
                        ],
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 6,
                      },
                    ],
                  ],
                  lte: [
                    [
                      5,
                      4,
                      {
                        kind: 'OR',
                        operands: [
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'EQ',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LTE',
                            value: 4,
                          },
                        ],
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 6,
                      },
                    ],
                  ],
                },
                gt: {
                  gt: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ],
                  ],
                  gte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ],
                  ],
                  lt: [
                    [
                      5,
                      4,
                      {
                        kind: 'OR',
                        operands: [
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GT',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LT',
                            value: 4,
                          },
                        ],
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'NOT',
                        value: 5,
                      },
                    ],
                    [5, 6, { kind: 'BOOLEAN', value: true }],
                  ],
                  lte: [
                    [
                      5,
                      4,
                      {
                        kind: 'OR',
                        operands: expect.arrayContaining([
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GT',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LTE',
                            value: 4,
                          },
                        ]),
                      },
                    ],
                    [5, 5, { kind: 'BOOLEAN', value: true }],
                    [5, 6, { kind: 'BOOLEAN', value: true }],
                  ],
                },
                gte: {
                  gte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 4,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ],
                  ],
                  lt: [
                    [
                      5,
                      4,
                      {
                        kind: 'OR',
                        operands: [
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GTE',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LT',
                            value: 4,
                          },
                        ],
                      },
                    ],
                    [5, 5, { kind: 'BOOLEAN', value: true }],
                    [5, 6, { kind: 'BOOLEAN', value: true }],
                  ],
                  lte: [
                    [
                      5,
                      4,
                      {
                        kind: 'OR',
                        operands: expect.arrayContaining([
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'GTE',
                            value: 5,
                          },
                          {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'LTE',
                            value: 4,
                          },
                        ]),
                      },
                    ],
                    [5, 5, { kind: 'BOOLEAN', value: true }],
                    [5, 6, { kind: 'BOOLEAN', value: true }],
                  ],
                },
                lt: {
                  lt: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 6,
                      },
                    ],
                  ],
                  lte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LT',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 6,
                      },
                    ],
                  ],
                },
                lte: {
                  lte: [
                    [
                      5,
                      4,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      5,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 5,
                      },
                    ],
                    [
                      5,
                      6,
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'LTE',
                        value: 6,
                      },
                    ],
                  ],
                },
              } as const).flatMap<
                [
                  label: string,
                  input: NodeFilterInputValue,
                  ast: BooleanFilter['ast'],
                ]
              >(([aOperator, config]) =>
                Object.entries(config).flatMap(([bOperator, values]) =>
                  values.map(([aValue, bValue, ast]: any): any => [
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
                    ast,
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
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([5, 10]) as any,
                  },
                ],
                [
                  'IN-4-6',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_in: [4, 6] }] },
                  { kind: 'BOOLEAN', value: false },
                ],
                [
                  'EQ-4',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id: 4 }] },
                  { kind: 'BOOLEAN', value: false },
                ],
                [
                  'EQ-5',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id: 5 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'EQ',
                    value: 5,
                  },
                ],
                [
                  'NOT-4',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_not: 4 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([0, 5, 10]) as any,
                  },
                ],
                [
                  'NOT-5',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_not: 5 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([0, 10]) as any,
                  },
                ],
                [
                  'GT-0',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_gt: 0 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([5, 10]) as any,
                  },
                ],
                [
                  'GT-5',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_gt: 5 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'EQ',
                    value: 10,
                  },
                ],
                [
                  'GT-10',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_gt: 10 }] },
                  { kind: 'BOOLEAN', value: false },
                ],
                [
                  'GTE-0',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_gte: 0 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([0, 5, 10]) as any,
                  },
                ],
                [
                  'GTE-5',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_gte: 5 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([5, 10]) as any,
                  },
                ],
                [
                  'GTE-10',
                  { AND: [{ _id_in: [0, 5, 10] }, { _id_gte: 10 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'EQ',
                    value: 10,
                  },
                ],
              ],
            ],
            [
              'IN - OR',
              [
                [
                  'IN-5-10',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_in: [5, 10] }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([0, 5, 10]) as any,
                  },
                ],
                [
                  'OR-4-6',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_in: [4, 6] }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([0, 4, 5, 6, 10]) as any,
                  },
                ],
                [
                  'EQ-4',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id: 4 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([0, 4, 5, 10]) as any,
                  },
                ],
                [
                  'EQ-5',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id: 5 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([0, 5, 10]) as any,
                  },
                ],
                [
                  'NOT-4',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_not: 4 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'NOT',
                    value: 4,
                  },
                ],
                [
                  'NOT-5',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_not: 5 }] },
                  { kind: 'BOOLEAN', value: true },
                ],
                [
                  'GT-0',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_gt: 0 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'GTE',
                    value: 0,
                  },
                ],
                [
                  'GT-5',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_gt: 5 }] },
                  {
                    kind: 'OR',
                    operands: expect.arrayContaining([
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'IN',
                        values: expect.arrayContaining([0, 5]) as any,
                      },
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 5,
                      },
                    ]) as any,
                  },
                ],
                [
                  'GT-10',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_gt: 10 }] },
                  {
                    kind: 'OR',
                    operands: expect.arrayContaining([
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'IN',
                        values: expect.arrayContaining([0, 5, 10]) as any,
                      },
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GT',
                        value: 10,
                      },
                    ]) as any,
                  },
                ],
                [
                  'GTE-0',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_gte: 0 }] },
                  {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'GTE',
                    value: 0,
                  },
                ],
                [
                  'GTE-5',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_gte: 5 }] },
                  {
                    kind: 'OR',
                    operands: expect.arrayContaining([
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'EQ',
                        value: 0,
                      },
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 5,
                      },
                    ]) as any,
                  },
                ],
                [
                  'GTE-10',
                  { OR: [{ _id_in: [0, 5, 10] }, { _id_gte: 10 }] },
                  {
                    kind: 'OR',
                    operands: expect.arrayContaining([
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'IN',
                        values: expect.arrayContaining([0, 5]) as any,
                      },
                      {
                        kind: 'LEAF',
                        leaf: '_id',
                        operator: 'GTE',
                        value: 10,
                      },
                    ]) as any,
                  },
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
                    kind: 'AND',
                    operands: [
                      {
                        kind: 'LEAF',
                        leaf: 'id',
                        operator: 'EQ',
                        value: '94de8a4b-a25f-4659-ba13-c84761ef135b',
                      },
                      {
                        kind: 'LEAF',
                        leaf: 'title',
                        operator: 'CONTAINS',
                        value: 'FRANCE',
                      },
                      {
                        kind: 'LEAF',
                        leaf: 'createdAt',
                        operator: 'GTE',
                        value: new Date('2021-01-01T00:00:00.000Z'),
                      },
                    ],
                  },
                ],
              ],
            ],
          ])(
            `%s`,
            (_label, tests) =>
              tests?.length &&
              it.each(tests)(`%# - %s`, (_label, input, ast) => {
                const node = gp.getNodeByName('Article');
                const filter =
                  node.filterInputType.parseAndFilter(input).filter;

                expect(filter.ast).toEqual(ast);
              }),
          );
        });

        describe(`Edges`, () => {
          it.each<
            [
              label: string,
              input: NodeFilterInputValue,
              ast: BooleanFilter['ast'],
            ]
          >([
            [
              'An article WITH any "category" - 0',
              { category_is_null: false },
              {
                kind: 'EDGE_EXISTS',
                edge: 'category',
              },
            ],

            [
              'An article WITH any "category" - 1',
              { category_not: null },
              {
                kind: 'EDGE_EXISTS',
                edge: 'category',
              },
            ],

            [
              'An article WITH any "category" - 2',
              { category: {} },
              {
                kind: 'EDGE_EXISTS',
                edge: 'category',
              },
            ],

            [
              'An article in the specified "category"',
              { category: { slug: 'news' } },
              {
                kind: 'EDGE_EXISTS',
                edge: 'category',
                headFilter: {
                  kind: 'NODE',
                  node: 'Category',
                  filter: {
                    kind: 'LEAF',
                    leaf: 'slug',
                    operator: 'EQ',
                    value: 'news',
                  },
                },
              },
            ],

            [
              'An article WITHOUT any "category" - 0',
              { category_is_null: true },
              {
                kind: 'NOT',
                operand: { kind: 'EDGE_EXISTS', edge: 'category' },
              },
            ],

            [
              'An article WITHOUT any "category" - 1',
              { category: null },
              {
                kind: 'NOT',
                operand: { kind: 'EDGE_EXISTS', edge: 'category' },
              },
            ],

            [
              'An article WITHOUT any "category" - 2',
              { category_not: {} },
              {
                kind: 'NOT',
                operand: { kind: 'EDGE_EXISTS', edge: 'category' },
              },
            ],

            [
              'An article not in the specified "category"',
              { category_not: { slug: 'news' } },
              {
                kind: 'NOT',
                operand: {
                  kind: 'EDGE_EXISTS',
                  edge: 'category',
                  headFilter: {
                    kind: 'NODE',
                    node: 'Category',
                    filter: {
                      kind: 'LEAF',
                      leaf: 'slug',
                      operator: 'EQ',
                      value: 'news',
                    },
                  },
                },
              },
            ],

            [
              'AND - 0',
              { AND: [{ category_not: {} }, { category: {} }] },
              { kind: 'BOOLEAN', value: false },
            ],

            [
              'AND - 1',
              {
                AND: [{ category_not: {} }, { category: { slug: 'news' } }],
              },
              { kind: 'BOOLEAN', value: false },
            ],

            [
              'AND - 2',
              {
                AND: [
                  { category_not: { slug: 'news' } },
                  { category: { slug: 'news' } },
                ],
              },
              { kind: 'BOOLEAN', value: false },
            ],

            [
              'OR - 0',
              {
                OR: [
                  { category: { slug: 'news' } },
                  { category: { slug: 'tv' } },
                ],
              },
              {
                kind: 'EDGE_EXISTS',
                edge: 'category',
                headFilter: {
                  kind: 'NODE',
                  node: 'Category',
                  filter: {
                    kind: 'LEAF',
                    leaf: 'slug',
                    operator: 'IN',
                    values: ['news', 'tv'],
                  },
                },
              },
            ],

            [
              'OR - 1',
              {
                OR: [{ category: { slug: 'news' } }, { category: {} }],
              },
              {
                kind: 'EDGE_EXISTS',
                edge: 'category',
              },
            ],
          ])('%s', (_label, input, ast) => {
            const node = gp.getNodeByName('Article');
            const filter = node.filterInputType.parseAndFilter(input).filter;

            expect(filter.ast).toEqual(ast);
          });
        });
      });

      describe(`Reverse-edges`, () => {
        describe('Unique', () => {
          it.each<
            [
              label: string,
              input: NodeFilterInputValue,
              ast: BooleanFilter['ast'],
            ]
          >([
            [
              'A user WITH any "profile" - 0',
              { profile_is_null: false },
              {
                kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'profile',
              },
            ],

            [
              'A user WITH any "profile" - 1',
              { profile_not: null },
              {
                kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'profile',
              },
            ],

            [
              'A user WITH any "profile" - 1',
              { profile: {} },
              {
                kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'profile',
              },
            ],

            [
              'An user with the specified "profile"',
              { profile: { birthday_not: null } },
              {
                kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'profile',
                headFilter: {
                  kind: 'NODE',
                  node: 'UserProfile',
                  filter: {
                    kind: 'LEAF',
                    leaf: 'birthday',
                    operator: 'NOT',
                    value: null,
                  },
                },
              },
            ],

            [
              'A user WITHOUT any "profile" - 0',
              { profile_is_null: true },
              {
                kind: 'NOT',
                operand: {
                  kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                  reverseEdge: 'profile',
                },
              },
            ],

            [
              'A user WITHOUT any "profile" - 1',
              { profile: null },
              {
                kind: 'NOT',
                operand: {
                  kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                  reverseEdge: 'profile',
                },
              },
            ],

            [
              'A user WITHOUT any "profile" - 1',
              { profile_not: {} },
              {
                kind: 'NOT',
                operand: {
                  kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                  reverseEdge: 'profile',
                },
              },
            ],

            [
              'A user not having the specified "profile"',
              { profile_not: { birthday_not: null } },
              {
                kind: 'NOT',
                operand: {
                  kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                  reverseEdge: 'profile',
                  headFilter: {
                    kind: 'NODE',
                    node: 'UserProfile',
                    filter: {
                      kind: 'LEAF',
                      leaf: 'birthday',
                      operator: 'NOT',
                      value: null,
                    },
                  },
                },
              },
            ],

            [
              'AND - 0',
              { AND: [{ profile_not: {} }, { profile: {} }] },
              { kind: 'BOOLEAN', value: false },
            ],

            [
              'AND - 1',
              {
                AND: [
                  { profile_not: { twitterHandle: '@yvannboucher' } },
                  { profile: { twitterHandle: '@yvannboucher' } },
                ],
              },
              { kind: 'BOOLEAN', value: false },
            ],

            [
              'AND - 2',
              {
                AND: [
                  { profile: { twitterHandle: 'ryanmdahl' } },
                  { profile: { facebookId: 'leeb' } },
                ],
              },
              {
                kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'profile',
                headFilter: {
                  kind: 'NODE',
                  node: 'UserProfile',
                  filter: {
                    kind: 'AND',
                    operands: [
                      {
                        kind: 'LEAF',
                        leaf: 'twitterHandle',
                        operator: 'EQ',
                        value: 'ryanmdahl',
                      },
                      {
                        kind: 'LEAF',
                        leaf: 'facebookId',
                        operator: 'EQ',
                        value: 'leeb',
                      },
                    ],
                  },
                },
              },
            ],

            [
              'OR - 0',
              {
                OR: [
                  { profile: { twitterHandle: 'ryanmdahl' } },
                  { profile: { twitterHandle: 'leeb' } },
                ],
              },
              {
                kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'profile',
                headFilter: {
                  kind: 'NODE',
                  node: 'UserProfile',
                  filter: {
                    kind: 'LEAF',
                    leaf: 'twitterHandle',
                    operator: 'IN',
                    values: ['ryanmdahl', 'leeb'],
                  },
                },
              },
            ],

            [
              'OR - 1',
              {
                OR: [
                  { profile: { twitterHandle: 'ryanmdahl' } },
                  { profile: {} },
                ],
              },
              {
                kind: 'UNIQUE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'profile',
              },
            ],
          ])('%s', (_label, input, ast) => {
            const node = gp.getNodeByName('User');
            const filter = node.filterInputType.parseAndFilter(input).filter;

            expect(filter.ast).toEqual(ast);
          });
        });

        describe('Multiple', () => {
          it.each<
            [
              label: string,
              input: NodeFilterInputValue,
              ast: BooleanFilter['ast'],
            ]
          >([
            [
              'An article WITH some "tags"',
              { tags_some: {} },
              {
                kind: 'MULTIPLE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'tags',
              },
            ],

            [
              'An article WITHOUT any deprecated "tags" - 0',
              { tags_none: { tag: { deprecated: true } } },
              {
                kind: 'NOT',
                operand: {
                  kind: 'MULTIPLE_REVERSE_EDGE_EXISTS',
                  reverseEdge: 'tags',
                  headFilter: {
                    kind: 'NODE',
                    node: 'ArticleTag',
                    filter: {
                      kind: 'EDGE_EXISTS',
                      edge: 'tag',
                      headFilter: {
                        kind: 'NODE',
                        node: 'Tag',
                        filter: {
                          kind: 'LEAF',
                          leaf: 'deprecated',
                          operator: 'EQ',
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
                kind: 'NOT',
                operand: {
                  kind: 'MULTIPLE_REVERSE_EDGE_EXISTS',
                  reverseEdge: 'tags',
                  headFilter: {
                    kind: 'NODE',
                    node: 'ArticleTag',
                    filter: {
                      kind: 'NOT',
                      operand: {
                        kind: 'EDGE_EXISTS',
                        edge: 'tag',
                        headFilter: {
                          kind: 'NODE',
                          node: 'Tag',
                          filter: {
                            kind: 'LEAF',
                            leaf: 'deprecated',
                            operator: 'IN',
                            values: [null, false],
                          },
                        },
                      },
                    },
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
                kind: 'MULTIPLE_REVERSE_EDGE_EXISTS',
                reverseEdge: 'tags',
                headFilter: {
                  kind: 'NODE',
                  node: 'ArticleTag',
                  filter: {
                    kind: 'AND',
                    operands: [
                      {
                        kind: 'EDGE_EXISTS',
                        edge: 'tag',
                        headFilter: {
                          kind: 'NODE',
                          node: 'Tag',
                          filter: {
                            kind: 'LEAF',
                            leaf: 'id',
                            operator: 'EQ',
                            value: 'ef31efed-361c-449c-a561-ed94eabbf60d',
                          },
                        },
                      },
                      {
                        kind: 'EDGE_EXISTS',
                        edge: 'article',
                        headFilter: {
                          kind: 'NODE',
                          node: 'Article',
                          filter: {
                            kind: 'LEAF',
                            leaf: '_id',
                            operator: 'IN',
                            values: [5, 6],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          ])('%s', (_label, input, ast) => {
            const node = gp.getNodeByName('Article');
            const filter = node.filterInputType.parseAndFilter(input).filter;

            expect(filter.ast).toEqual(ast);
          });
        });
      });

      describe('Others', () => {
        it.each<
          [
            label: string,
            input: NodeFilterInputValue,
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
              kind: 'OR',
              operands: [
                {
                  kind: 'LEAF',
                  leaf: '_id',
                  operator: 'NOT',
                  value: 20,
                },
                {
                  kind: 'LEAF',
                  leaf: 'status',
                  operator: 'IN',
                  values: ['deleted', 'draft'],
                },
                {
                  kind: 'NOT',
                  operand: {
                    kind: 'EDGE_EXISTS',
                    edge: 'category',
                    headFilter: {
                      kind: 'NODE',
                      node: 'Category',
                      filter: {
                        kind: 'NOT',
                        operand: {
                          kind: 'LEAF',
                          leaf: 'slug',
                          operator: 'IN',
                          values: ['news', 'tv'],
                        },
                      },
                    },
                  },
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
              kind: 'AND',
              operands: expect.arrayContaining([
                {
                  kind: 'EDGE_EXISTS',
                  edge: 'category',
                  headFilter: {
                    kind: 'NODE',
                    node: 'Category',
                    filter: {
                      kind: 'LEAF',
                      leaf: 'slug',
                      operator: 'IN',
                      values: ['news', 'home'],
                    },
                  },
                },
                {
                  kind: 'NOT',
                  operand: {
                    kind: 'LEAF',
                    leaf: '_id',
                    operator: 'IN',
                    values: expect.arrayContaining([1, 2, 4, 5, 6, 3]),
                  },
                },
              ]) as any,
            },
          ],

          [
            'An "IN" with lot of values',
            {
              OR: [{ _id: 1 }, { _id_in: R.range(2, 1000) }],
            },
            {
              kind: 'LEAF',
              leaf: '_id',
              operator: 'IN',
              values: expect.arrayContaining([1, 999]) as any,
            },
          ],
        ])('%s', (_label, input, ast) => {
          const node = gp.getNodeByName('Article');
          const filter = node.filterInputType.parseAndFilter(input).filter;

          expect(filter.ast).toEqual(ast);
        });

        it('A big disjunction', () => {
          const node = gp.getNodeByName('ArticleTag');
          const items = Array(1000);

          expect(
            node.filterInputType.parseAndFilter({
              OR: Array.from(items, (_, i) => ({
                article: { _id: i },
                tag: { id: '0f9131ff-e615-4a7a-ab9a-57c2032aaf6c' },
              })),
            }).inputValue,
          ).toEqual({
            article: { _id_in: Array.from(items, (_, i) => i) },
            tag: { id: '0f9131ff-e615-4a7a-ab9a-57c2032aaf6c' },
          });
        });
      });
    });
  });
});
