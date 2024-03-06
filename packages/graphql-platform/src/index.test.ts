import { beforeAll, describe, expect, it } from '@jest/globals';
import * as graphql from 'graphql';
import { customOperations, nodes } from './__tests__/config.js';
import {
  GraphQLPlatform,
  type Operation,
  type OperationType,
} from './index.js';

describe('GraphQL-Platform', () => {
  describe('Fails', () => {
    it.each([
      [
        undefined,
        `/GraphQLPlatformConfig - Expects a plain-object, got: undefined`,
      ],
      [null, `/GraphQLPlatformConfig - Expects a plain-object, got: null`],
    ])('throws an Error on invalid config: %p', (config, expectedError) => {
      // @ts-expect-error
      expect(() => new GraphQLPlatform(config)).toThrow(expectedError);
    });

    it.each([
      [
        {},
        `/GraphQLPlatformConfig/nodes - Expects a plain-object, got: undefined`,
      ],
      [
        { nodes: undefined },
        `/GraphQLPlatformConfig/nodes - Expects a plain-object, got: undefined`,
      ],
      [
        { nodes: null },
        `/GraphQLPlatformConfig/nodes - Expects a plain-object, got: null`,
      ],
      [
        { nodes: {} },
        `/GraphQLPlatformConfig/nodes - Expects at least one node, got: {}`,
      ],
    ])('throws an Error on invalid nodes: %p', (config, expectedError) => {
      // @ts-expect-error
      expect(() => new GraphQLPlatform(config)).toThrow(expectedError);
    });
  });

  describe('Works', () => {
    let gp: GraphQLPlatform;

    beforeAll(() => {
      gp = new GraphQLPlatform({
        subscription: { public: true },
        nodes,
        customOperations,
      });
    });

    it(`has nodes' definition`, () => {
      expect(Array.from(gp.nodesByName.keys())).toEqual([
        'Article',
        'ArticleExtension',
        'Category',
        'Tag',
        'ArticleTag',
        'ArticleTagModeration',
        'User',
        'UserProfile',
        'Log',
      ]);
    });

    it.each<
      [operationType: OperationType, enabledCount: number, publicCount: number]
    >([
      [graphql.OperationTypeNode.QUERY, 65, 57],
      [graphql.OperationTypeNode.MUTATION, 84, 71],
      [graphql.OperationTypeNode.SUBSCRIPTION, 12, 7],
    ])(
      `generates %s: %d enabled / %d public`,
      (operationType, enabledCount, publicCount) => {
        expect(
          Array.from<Operation>(
            gp.nodeOperationsByNameByType[operationType].values(),
          ).filter((operation) => operation.isEnabled()).length,
        ).toBe(enabledCount);

        expect(
          Array.from<Operation>(
            gp.nodeOperationsByNameByType[operationType].values(),
          ).filter((operation) => operation.isPublic()).length,
        ).toBe(publicCount);
      },
    );

    it('generates a valid GraphQL Schema', () => {
      expect(graphql.printSchema(gp.schema)).toMatchSnapshot();
    });
  });
});
