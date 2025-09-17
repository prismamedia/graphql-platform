import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  type MyContext,
  myAdminContext,
  myVisitorContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  clearConnectorMockCalls,
  mockConnector,
} from '../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../index.js';
import { UnauthorizedError } from '../error.js';
import {
  type ChangesSubscriptionArgs,
  ChangesSubscriptionStream,
} from './changes.js';

describe('ChangesSubscription', () => {
  const gp = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ find: async () => [] }),
  });

  const Article = gp.getNodeByName('Article');

  beforeEach(() => clearConnectorMockCalls(gp.connector));

  describe('Fails', () => {
    (
      [
        [myVisitorContext, { selection: { onUpsert: ['id'] } }],
      ] satisfies ReadonlyArray<[MyContext, ChangesSubscriptionArgs]>
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', async () => {
        await assert.rejects(
          async () => gp.api.Article.subscribeToChanges(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });
  });

  describe('Works', () => {
    (
      [
        [myAdminContext, { where: null, selection: { onUpsert: '{ id }' } }],
      ] satisfies ReadonlyArray<[MyContext, ChangesSubscriptionArgs]>
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        await using subscription = await Article.api.subscribeToChanges(
          context,
          args,
        );

        assert(subscription instanceof ChangesSubscriptionStream);
        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });
  });
});
