import assert from 'node:assert';
import { before, describe, it } from 'node:test';
import {
  type MyContext,
  myAdminContext,
  nodes,
} from '../../__tests__/config.js';
import { mockConnector } from '../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../index.js';
import type { API, ContextBoundAPI } from './api.js';
import { ChangesSubscriptionStream } from './subscription.js';

describe('API', () => {
  const gp = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ count: async () => 5, find: async () => [] }),
  });

  describe('API', () => {
    const api: API<MyContext> = gp.api;

    it('is callable', async () => {
      assert.strictEqual(await api.Article.count(myAdminContext, {}), 5);

      assert.deepEqual(
        await api.Article.findMany(myAdminContext, {
          first: 5,
          selection: `{ id }`,
        }),
        [],
      );

      assert.deepEqual(
        await Array.fromAsync(
          api.Article.scroll(myAdminContext, { selection: `{ id }` }),
        ),
        [],
      );

      {
        await using subscription = await api.Article.subscribeToChanges(
          myAdminContext,
          { selection: { onUpsert: `{ id }` } },
        );

        assert(subscription instanceof ChangesSubscriptionStream);
      }
    });
  });

  describe('Context-bound API', () => {
    let api: ContextBoundAPI;

    before(() => {
      api = gp.createContextBoundAPI(myAdminContext);
    });

    it('is callable', async () => {
      assert.strictEqual(await api.Article.count({}), 5);

      assert.deepEqual(
        await api.Article.findMany({ first: 5, selection: `{ id }` }),
        [],
      );

      assert.deepEqual(
        await Array.fromAsync(
          api.Article.scroll({ selection: `{ id title }` }),
        ),
        [],
      );

      {
        await using subscription = await api.Article.subscribeToChanges({
          selection: { onUpsert: `{ id }` },
        });

        assert(subscription instanceof ChangesSubscriptionStream);
      }
    });
  });
});
