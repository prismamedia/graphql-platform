import { beforeAll, describe, expect, it } from '@jest/globals';
import * as graphql from 'graphql';
import { MyGP, nodeNames, nodes } from '../../../__tests__/config.js';
import {
  GraphQLPlatform,
  Node,
  NodeCreationInputValue,
} from '../../../index.js';
import { NodeCreationInputType } from './creation.js';

describe('NodeCreationInputType', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ nodes });
  });

  describe('Definition', () => {
    it.each(nodeNames)('%s has a creation input type', (nodeName) => {
      const node = gp.getNodeByName(nodeName);

      const creationInputType = node.creationInputType;
      expect(creationInputType).toBeInstanceOf(NodeCreationInputType);

      if (node.isPubliclyCreatable()) {
        expect(creationInputType.getGraphQLInputType()).toBeInstanceOf(
          graphql.GraphQLInputObjectType,
        );

        expect(
          graphql.printType(creationInputType.getGraphQLInputType()),
        ).toMatchSnapshot(creationInputType.name);
      } else {
        expect(() => creationInputType.getGraphQLInputType()).toThrowError(
          `The "${nodeName}CreationInput" input type is private`,
        );
      }

      node.edgeSet.forEach((edge) => {
        const creationInputType = node.getCreationWithoutEdgeInputType(edge);
        expect(creationInputType).toBeInstanceOf(NodeCreationInputType);

        if (creationInputType.isPublic()) {
          expect(
            graphql.printType(creationInputType.getGraphQLInputType()),
          ).toMatchSnapshot(creationInputType.name);
        } else {
          expect(() => creationInputType.getGraphQLInputType()).toThrowError(
            `The "${nodeName}CreationInput" input type is private`,
          );
        }
      });
    });
  });

  describe('Runtime', () => {
    describe('Fails', () => {
      it.each([
        [
          'Article',
          {},
          '/title - Expects a non-undefined "NonEmptyTrimmedString"',
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
          '/category - Expects one and only one action, got: [Object: null prototype] {',
        ],
      ])(
        '%sCreationInput.parseValue(%p) throws an error',
        (nodeName, value, error) => {
          const node = gp.getNodeByName(nodeName);
          const creationInputType = node.creationInputType;

          expect(() => creationInputType.parseValue(value)).toThrowError(error);
        },
      );
    });

    describe('Works', () => {
      it.each<
        [nodeName: Node['name'], data: NonNullable<NodeCreationInputValue>]
      >([
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
      ])('%sCreationInput.parseValue(%p)', (nodeName, data) =>
        expect(
          gp.getNodeByName(nodeName).creationInputType.parseValue(data),
        ).toBeDefined(),
      );
    });
  });
});
