import * as graphql from 'graphql';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { inspect } from 'node:util';
import { type MyGP, nodeNames, nodes } from '../../../__tests__/config.js';
import {
  GraphQLPlatform,
  Node,
  type NodeUpdateInputValue,
} from '../../../index.js';
import { NodeUpdateInputType } from './update.js';

describe('NodeUpdateInputType', () => {
  let gp: MyGP;

  before(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    nodeNames.forEach((nodeName) => {
      it(`${nodeName} may have an update input type`, ({
        assert: { snapshot },
      }) => {
        const node = gp.getNodeByName(nodeName);

        if (node.isUpdatable()) {
          const updateInputType = node.updateInputType;
          assert(updateInputType instanceof NodeUpdateInputType);

          if (updateInputType.isPublic()) {
            assert(
              updateInputType.getGraphQLInputType() instanceof
                graphql.GraphQLInputObjectType,
            );

            snapshot(graphql.printType(updateInputType.getGraphQLInputType()));
          } else {
            assert.throws(() => updateInputType.getGraphQLInputType(), {
              message: `The "${nodeName}UpdateInput" input type is private`,
            });
          }
        }

        node.edgeSet.forEach((edge) => {
          if (node.isUpdatable(edge)) {
            const updateInputType = node.getUpdateWithoutEdgeInputType(edge);
            assert(updateInputType instanceof NodeUpdateInputType);

            if (updateInputType.isPublic()) {
              assert(
                updateInputType.getGraphQLInputType() instanceof
                  graphql.GraphQLInputObjectType,
              );

              snapshot(
                graphql.printType(updateInputType.getGraphQLInputType()),
              );
            } else {
              assert.throws(() => updateInputType.getGraphQLInputType(), {
                message: `The "${nodeName}UpdateInput" input type is private`,
              });
            }
          } else {
            assert.throws(() => node.getUpdateWithoutEdgeInputType(edge), {
              message: `The "${nodeName}" node is not updatable`,
            });
          }
        });
      });
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      (
        [
          [
            'Article',
            {
              category: {},
            },
            '/category - Expects one and only one action, got: [Object: null prototype] {}',
          ],
          [
            'Article',
            {
              category: {
                connect: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
                connectIfExists: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
              },
            },
            new RegExp(
              '^\\/category - Expects one and only one action, got: \\[Object: null prototype\\] {',
            ),
          ],
        ] as const
      ).forEach(([nodeName, value, error]) => {
        it(`${nodeName}UpdateInput.parseValue(${inspect(value, undefined, 5)}) throws an error`, () => {
          const node = gp.getNodeByName(nodeName);

          const updateInputType = node.updateInputType;
          assert(updateInputType instanceof NodeUpdateInputType);

          assert.throws(() => updateInputType.parseValue(value), {
            message: error,
          });
        });
      });
    });

    describe('Works', () => {
      (
        [
          [
            'Article',
            {
              title: "My new article's title",
              category: { disconnect: true },
              updatedBy: {
                connect: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
              },
              tags: {
                create: [
                  {
                    order: 3,
                    tag: {
                      connect: { id: '77759b36-b7c2-4ec1-af9a-8a45cc853e9a' },
                    },
                  },
                ],
              },
            },
          ],
          [
            'Article',
            {
              extension: { delete: true },
            },
          ],
          [
            'Article',
            {
              extension: { deleteIfExists: true },
            },
          ],
          [
            'Article',
            {
              extension: { create: { source: null } },
            },
          ],
          [
            'Article',
            {
              extension: { createIfNotExists: { source: null } },
            },
          ],
          [
            'Article',
            {
              extension: { update: {} },
            },
          ],
          [
            'Article',
            {
              extension: { updateIfExists: {} },
            },
          ],
          [
            'Article',
            {
              extension: {
                upsert: { create: { source: null }, update: { source: null } },
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                deleteAll: true,
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                deleteMany: { order_gt: 2 },
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                delete: [{ order: 1 }, { order: 2 }],
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                deleteIfExists: [{ order: 1 }, { order: 2 }],
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                create: [
                  { order: 1, tag: { connect: { slug: 'tv' } } },
                  { order: 2, tag: { connect: { slug: 'news' } } },
                ],
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                create: [
                  { order: 1, tag: { connect: { slug: 'tv' } } },
                  { order: 2, tag: { connect: { slug: 'news' } } },
                ],
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                createIfNotExists: [
                  {
                    where: { order: 1 },
                    data: { order: 1, tag: { connect: { slug: 'tv' } } },
                  },
                  {
                    where: { order: 2 },
                    data: { order: 2, tag: { connect: { slug: 'news' } } },
                  },
                ],
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                update: [
                  { where: { order: 1 }, data: { order: 2 } },
                  { where: { order: 3 }, data: { order: 4 } },
                ],
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                updateIfExists: [
                  { where: { order: 1 }, data: { order: 2 } },
                  { where: { order: 3 }, data: { order: 4 } },
                ],
              },
            },
          ],
          [
            'Article',
            {
              tags: {
                upsert: [
                  {
                    where: { order: 1 },
                    create: { order: 2, tag: { connect: { slug: 'tv' } } },
                    update: { order: 2 },
                  },
                  {
                    where: { order: 3 },
                    create: { order: 4, tag: { connect: { slug: 'news' } } },
                    update: { order: 4 },
                  },
                ],
              },
            },
          ],
        ] as [nodeName: Node['name'], data: NonNullable<NodeUpdateInputValue>][]
      ).forEach(([nodeName, data]) => {
        it(`${nodeName}UpdateInput.parseValue(${inspect(data, undefined, 5)})`, () => {
          const node = gp.getNodeByName(nodeName);

          const updateInputType = node.updateInputType;
          assert(updateInputType instanceof NodeUpdateInputType);

          assert(updateInputType.parseValue(data));
        });
      });
    });
  });
});
