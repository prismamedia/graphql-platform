import * as graphql from 'graphql';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { inspect } from 'node:util';
import { type MyGP, nodeNames, nodes } from '../../../__tests__/config.js';
import { Edge, GraphQLPlatform, Node } from '../../../index.js';
import {
  NodeUniqueFilterInputType,
  type NodeUniqueFilterInputValue,
} from './unique-filter.js';

describe('NodeUniqueFilterInputType', () => {
  let gp: MyGP;

  before(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    nodeNames.forEach((nodeName) => {
      it(`${nodeName} has a unique filter input type`, ({
        assert: { snapshot },
      }) => {
        const node = gp.getNodeByName(nodeName);

        const uniqueFilterInputType = node.uniqueFilterInputType;
        assert(uniqueFilterInputType instanceof NodeUniqueFilterInputType);

        if (node.isPublic()) {
          assert(
            uniqueFilterInputType.getGraphQLInputType() instanceof
              graphql.GraphQLInputObjectType,
          );

          snapshot(
            graphql.printType(uniqueFilterInputType.getGraphQLInputType()),
          );
        } else {
          assert.throws(() => uniqueFilterInputType.getGraphQLInputType(), {
            message: `The "${nodeName}UniqueFilterInput" input type is private`,
          });
        }

        node.edgeSet.forEach((edge) => {
          if (node.isPartiallyIdentifiableByEdge(edge)) {
            const uniqueFilterInputType =
              node.getUniqueFilterWithoutEdgeInputType(edge);

            assert(uniqueFilterInputType instanceof NodeUniqueFilterInputType);

            if (uniqueFilterInputType.isPublic()) {
              snapshot(
                graphql.printType(uniqueFilterInputType.getGraphQLInputType()),
              );
            } else {
              assert.throws(() => uniqueFilterInputType.getGraphQLInputType(), {
                message: `The "${nodeName}UniqueFilterInput" input type is private`,
              });
            }
          } else {
            assert.throws(
              () => node.getUniqueFilterWithoutEdgeInputType(edge),
              {
                message: `The "${nodeName}" node is not partially identifiable by its "${edge.name}" edge`,
              },
            );
          }
        });
      });
    });
  });

  describe('Parser', () => {
    describe('Fails', () => {
      (
        [
          [
            'Article',
            undefined,
            { id_is_null: true },
            'Expects not to contain the extra key(s): id_is_null',
          ],
          [
            'Article',
            undefined,
            { id: null },
            '/id - Expects a non-null "UUIDv4", got: null',
          ],
          [
            'Article',
            undefined,
            { id: 123 },
            `/id - Expects an "UUIDv4", got: 123`,
          ],
          [
            'Article',
            undefined,
            { category: { parent: { title: null } }, slug: 'you-re-welcome' },
            '/category/parent - Expects not to contain the extra key(s): title',
          ],
        ] as const
      ).forEach(([nodeName, forcedEdgeName, value, error]) => {
        it(`${nodeName}UniqueFilterInput.parseValue(${inspect(value, undefined, 5)}) throws an error`, () => {
          const node = gp.getNodeByName(nodeName);
          const uniqueFilterInputType = forcedEdgeName
            ? node.getUniqueFilterWithoutEdgeInputType(
                node.getEdgeByName(forcedEdgeName),
              )
            : node.uniqueFilterInputType;

          assert.throws(() => uniqueFilterInputType.parseValue(value), {
            message: error,
          });
        });
      });
    });

    describe('Works', () => {
      (
        [
          ['Article', undefined, undefined, undefined],
          ['Article', undefined, null, null],
          ['Article', undefined, { _id: 123 }, { _id: 123 }],
          [
            'Article',
            undefined,
            { id: 'e22205cc-7d8e-4772-a46d-528a29fb81f2' },
            { id: 'e22205cc-7d8e-4772-a46d-528a29fb81f2' },
          ],
          ['Article', 'category', { slug: 'my-slug' }, { slug: 'my-slug' }],
          [
            'Category',
            undefined,
            {
              parent: { id: '6684d029-0016-4615-b1e7-f7f0087dbf11' },
              order: 789,
            },
            {
              parent: { id: '6684d029-0016-4615-b1e7-f7f0087dbf11' },
              order: 789,
            },
          ],
          [
            'Category',
            undefined,
            { parent: null, slug: 'root' },
            { parent: null, slug: 'root' },
          ],
          [
            'Category',
            undefined,
            {
              parent: {
                _id: 999,
                slug: 'root',
                id: 'd038d5cf-815e-4f8d-8099-1def0bdec246',
              },
              order: 789,
            },
            {
              parent: {
                _id: 999,
              },
              order: 789,
            },
          ],
          ['Category', 'parent', { slug: 'root' }, { slug: 'root' }],
        ] as [
          Node['name'],
          Edge['name'] | undefined,
          NodeUniqueFilterInputValue,
          NodeUniqueFilterInputValue,
        ][]
      ).forEach(([nodeName, forcedEdgeName, inputValue, parsedValue]) => {
        it(`${nodeName}UniqueFilterInput.parseValue(${inspect(inputValue, undefined, 5)})`, () => {
          const node = gp.getNodeByName(nodeName);
          const uniqueFilterInputType = forcedEdgeName
            ? node.getUniqueFilterWithoutEdgeInputType(
                node.getEdgeByName(forcedEdgeName),
              )
            : node.uniqueFilterInputType;

          assert.deepEqual(
            uniqueFilterInputType.parseValue(inputValue),
            parsedValue,
          );

          if (inputValue != null) {
            assert(uniqueFilterInputType.isValid(inputValue));

            assert.deepEqual(
              uniqueFilterInputType.pickValue({
                ...inputValue,
                unknown: 'any',
              }),
              parsedValue,
            );

            assert(
              uniqueFilterInputType.hasValid({
                ...inputValue,
                unknown: 'any',
              }),
            );
          }
        });
      });

      describe('areValuesEqual', () => {
        (
          [
            ['Article', undefined, undefined, true],
            ['Article', null, null, true],
            ['Article', { _id: 123 }, { _id: 123 }, true],
            [
              'Category',
              { parent: null, order: 1 },
              { parent: null, order: 1 },
              true,
            ],
            [
              'Category',
              { parent: null, order: 1 },
              { parent: null, order: 2 },
              false,
            ],
            [
              'Category',
              {
                parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
                order: 1,
              },
              {
                parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
                order: 1,
              },
              true,
            ],
            [
              'Category',
              {
                parent: { id: '76784b6c-ddf5-46a5-b8d7-4697c8c68e66' },
                order: 1,
              },
              {
                parent: { id: '8db764c6-8a4d-492c-876e-7cfa2fdd455f' },
                order: 1,
              },
              false,
            ],
          ] as const
        ).forEach(([nodeName, a, b, result]) => {
          it(`${nodeName}UniqueFilterInput.areValuesEqual(${inspect(a, undefined, 5)}, ${inspect(b, undefined, 5)}) = ${result}`, () => {
            const node = gp.getNodeByName(nodeName);
            const uniqueFilterInputType = node.uniqueFilterInputType;

            assert.doesNotThrow(() => uniqueFilterInputType.parseValue(a));
            assert.doesNotThrow(() => uniqueFilterInputType.parseValue(b));

            assert.strictEqual(
              uniqueFilterInputType.areValuesEqual(a, b),
              result,
            );
          });
        });
      });
    });
  });
});
