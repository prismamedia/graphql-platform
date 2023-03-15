import { beforeAll, describe, expect, it } from '@jest/globals';
import * as graphql from 'graphql';
import { GraphQLPlatform } from './index.js';
import { customOperations, nodes } from './__tests__/config.js';

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
      expect(() => new GraphQLPlatform(config)).toThrowError(expectedError);
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
      expect(() => new GraphQLPlatform(config)).toThrowError(expectedError);
    });
  });

  describe('Works', () => {
    let gp: GraphQLPlatform;

    beforeAll(() => {
      gp = new GraphQLPlatform({ nodes, customOperations });
    });

    it(`has nodes' definition`, () => {
      expect(Array.from(gp.nodesByName.keys())).toEqual([
        'Article',
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
      [
        operationType: graphql.OperationTypeNode,
        enabledCount: number,
        publicCount: number,
      ]
    >([
      [graphql.OperationTypeNode.QUERY, 56, 49],
      [graphql.OperationTypeNode.MUTATION, 61, 54],
      [graphql.OperationTypeNode.SUBSCRIPTION, 0, 0],
    ])(
      `generates %s: %d enabled / %d public`,
      (operationType, enabledCount, publicCount) => {
        expect(
          Array.from(gp.operationsByNameByType[operationType].values()).filter(
            (operation) => operation.isEnabled(),
          ),
        ).toHaveLength(enabledCount);

        expect(
          Array.from(gp.operationsByNameByType[operationType].values()).filter(
            (operation) => operation.isPublic(),
          ),
        ).toHaveLength(publicCount);
      },
    );

    it('generates a valid GraphQL Schema', () => {
      expect(graphql.printSchema(gp.schema)).toMatchSnapshot();
    });
  });
});
