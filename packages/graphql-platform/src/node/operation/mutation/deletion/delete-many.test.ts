import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  MyContext,
  MyGP,
  myAdminContext,
  myUserContext,
  myVisitorContext,
  nodes,
} from '../../../../__tests__/config.js';
import {
  clearConnectorMockCalls,
  mockConnector,
  type MockedConnector,
} from '../../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../../index.js';
import { UnauthorizedError } from '../../error.js';
import { DeleteManyMutationArgs } from './delete-many.js';

describe('DeleteManyMutation', () => {
  const gp: MyGP<MockedConnector> = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ find: async () => [], delete: async () => 0 }),
  });

  beforeEach(() => clearConnectorMockCalls(gp.connector));

  describe('Fails', () => {
    (
      [
        [myVisitorContext, { first: 5, selection: '{ id }' }],
        [myUserContext, { first: 5, selection: '{ id }' }],
      ] satisfies ReadonlyArray<[MyContext, DeleteManyMutationArgs]>
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', async () => {
        await assert.rejects(
          () => gp.api.Article.deleteMany(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
        assert.strictEqual(gp.connector.delete.mock.callCount(), 0);
      });
    });
  });

  describe('Works', () => {
    (
      [
        [myAdminContext, { first: 0, selection: '{ id }' }],
        [myAdminContext, { where: null, first: 5, selection: '{ id }' }],
      ] satisfies ReadonlyArray<[MyContext, DeleteManyMutationArgs]>
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        assert.deepStrictEqual(
          await gp.api.Article.deleteMany(context, args),
          [],
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
        assert.strictEqual(gp.connector.delete.mock.callCount(), 0);
      });
    });
  });
});
