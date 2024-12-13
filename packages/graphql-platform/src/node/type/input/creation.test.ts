import * as graphql from 'graphql';
import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import { inspect } from 'node:util';
import { MyGP, nodeNames, nodes } from '../../../__tests__/config.js';
import { GraphQLPlatform } from '../../../index.js';
import { NodeCreationInputType } from './creation.js';

describe('NodeCreationInputType', () => {
  let gp: MyGP;

  before(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    nodeNames.forEach((nodeName) => {
      it(`${nodeName} has a creation input type`, ({
        assert: { snapshot },
      }) => {
        const node = gp.getNodeByName(nodeName);

        const creationInputType = node.creationInputType;
        assert(creationInputType instanceof NodeCreationInputType);

        if (node.isPubliclyCreatable()) {
          assert(
            creationInputType.getGraphQLInputType() instanceof
              graphql.GraphQLInputObjectType,
          );

          snapshot(graphql.printType(creationInputType.getGraphQLInputType()));
        } else {
          assert.throws(() => creationInputType.getGraphQLInputType(), {
            message: `The "${nodeName}CreationInput" input type is private`,
          });
        }

        node.edgeSet.forEach((edge) => {
          const creationInputType = node.getCreationWithoutEdgeInputType(edge);
          assert(creationInputType instanceof NodeCreationInputType);

          if (creationInputType.isPublic()) {
            snapshot(
              graphql.printType(creationInputType.getGraphQLInputType()),
            );
          } else {
            assert.throws(() => creationInputType.getGraphQLInputType(), {
              message: `The "${nodeName}CreationInput" input type is private`,
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
            {},
            '/title - Expects a non-undefined "NonEmptySanitizedString", got: undefined',
          ],
          [
            'Article',
            {
              title: 'My valid title',
              category: {},
            },
            '/category - Expects one and only one action, got: [Object: null prototype] {}',
          ],
          [
            'Article',
            {
              title: 'My valid title',
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
        it(`${nodeName}CreationInput.parseValue(${inspect(value, undefined, 5)}) throws an error`, () => {
          const node = gp.getNodeByName(nodeName);
          const creationInputType = node.creationInputType;

          assert.throws(() => creationInputType.parseValue(value), {
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
              title: "My article's title",
              status: undefined,
              category: {
                connectIfExists: { id: '91a7c846-b030-4ef3-aaaa-747fe7b11519' },
              },
              createdBy: {
                connect: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
              },
              updatedBy: {
                connect: { id: '2059b77a-a735-41fe-b415-5b12944b6ba6' },
              },
              tags: {
                create: [
                  {
                    order: 1,
                    tag: {
                      connect: { id: '171cb511-02a8-462a-9664-92d58cc65fa1' },
                    },
                  },
                  {
                    order: 2,
                    tag: {
                      connect: { id: 'a69c30d5-37e9-4d10-82f9-3f4b734834b8' },
                    },
                  },
                ],
              },
              extension: { create: { source: 'AFP' } },
            },
          ],
          [
            'User',
            {
              username: 'yvann',
              profile: {
                create: {
                  birthday: '1987-04-28',
                  twitterHandle: '@yvannboucher',
                },
              },
            },
          ],
        ] as const
      ).forEach(([nodeName, value]) => {
        it(`${nodeName}CreationInput.parseValue(${inspect(value, undefined, 5)})`, () => {
          const node = gp.getNodeByName(nodeName);
          const creationInputType = node.creationInputType;

          assert.doesNotThrow(() => creationInputType.parseValue(value));
        });
      });
    });
  });
});
