import * as graphql from 'graphql';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { customOperations, nodes } from './__tests__/config.js';
import {
  GraphQLPlatform,
  type Operation,
  type OperationType,
} from './index.js';

describe('GraphQL-Platform', () => {
  describe('Fails', () => {
    it('throws an error on invalid config', async (t) => {
      const cases = [
        [
          undefined,
          `/GraphQLPlatformConfig - Expects a plain-object, got: undefined`,
        ],
        [null, `/GraphQLPlatformConfig - Expects a plain-object, got: null`],
      ] as const;

      for (const [config, expectedError] of cases) {
        assert.throws(
          // @ts-expect-error
          () => new GraphQLPlatform(config),
          { message: expectedError },
        );
      }
    });

    it('throws an error on invalid nodes', async (t) => {
      const cases = [
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
      ] as const;

      for (const [config, expectedError] of cases) {
        assert.throws(
          // @ts-expect-error
          () => new GraphQLPlatform(config),
          { message: expectedError },
        );
      }
    });
  });

  describe('Works', () => {
    const gp = new GraphQLPlatform({
      subscription: { public: true },
      nodes,
      customOperations,
    });

    it(`has nodes' definition`, () => {
      assert.deepStrictEqual(Array.from(gp.nodesByName.keys()), [
        'Article',
        'ArticleHistory',
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

    it('generates operations with correct counts', () => {
      const cases = [
        [graphql.OperationTypeNode.QUERY, 72, 64],
        [graphql.OperationTypeNode.MUTATION, 124, 107],
        [graphql.OperationTypeNode.SUBSCRIPTION, 8, 6],
      ] satisfies [
        operationType: OperationType,
        enabledCount: number,
        publicCount: number,
      ][];

      for (const [operationType, enabledCount, publicCount] of cases) {
        assert.strictEqual(
          Array.from<Operation>(
            gp.nodeOperationsByNameByType[operationType].values(),
          ).filter((operation) => operation.isEnabled()).length,
          enabledCount,
        );

        assert.strictEqual(
          Array.from<Operation>(
            gp.nodeOperationsByNameByType[operationType].values(),
          ).filter((operation) => operation.isPublic()).length,
          publicCount,
        );
      }
    });

    it('generates a valid GraphQL Schema', ({ assert: { snapshot } }) => {
      snapshot(graphql.printSchema(gp.schema));
    });
  });
});
