import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  myAdminContext,
  myVisitorContext,
  nodes,
  type MyContext,
  type MyGP,
} from '../../../../__tests__/config.js';
import {
  clearConnectorMockCalls,
  mockConnector,
  type MockedConnector,
} from '../../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../../index.js';
import { UnauthorizedError } from '../../error.js';
import type { UpdateManyMutationArgs } from './update-many.js';

describe('UpdateManyMutation', () => {
  const gp: MyGP<MockedConnector> = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ update: async () => 0 }),
  });

  beforeEach(() => clearConnectorMockCalls(gp.connector));

  describe('Fails', () => {
    (
      [
        [myVisitorContext, { data: {}, first: 5, selection: '{ id }' }],
      ] satisfies ReadonlyArray<[MyContext, UpdateManyMutationArgs]>
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', async () => {
        await assert.rejects(
          () => gp.api.Article.updateMany(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
        assert.strictEqual(gp.connector.update.mock.callCount(), 0);
      });
    });
  });

  describe('Works', () => {
    (
      [
        [myAdminContext, { data: {}, first: 0, selection: '{ id }' }],
        [
          myAdminContext,
          { data: {}, where: null, first: 5, selection: '{ id }' },
        ],
      ] satisfies ReadonlyArray<[MyContext, UpdateManyMutationArgs]>
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        assert.deepStrictEqual(
          await gp.api.Article.updateMany(context, args),
          [],
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
        assert.strictEqual(gp.connector.update.mock.callCount(), 0);
      });
    });
  });
});
