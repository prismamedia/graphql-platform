import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  MyContext,
  MyGP,
  myAdminContext,
  nodes,
} from '../../__tests__/config.js';
import { mockConnector } from '../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../index.js';
import { API, ContextBoundAPI } from './api.js';
import { ChangesSubscriptionStream } from './subscription.js';

describe('API', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ count: async () => 5, find: async () => [] }),
    });
  });

  describe('API', () => {
    let api: API<MyContext>;

    beforeAll(() => {
      api = gp.api;
    });

    it('is callable', async () => {
      await expect(api.Article.count(myAdminContext, {})).resolves.toEqual(5);

      await expect(
        api.Article.findMany(myAdminContext, { first: 5, selection: `{ id }` }),
      ).resolves.toEqual([]);

      await expect(
        Array.fromAsync(
          api.Article.scroll(myAdminContext, { selection: `{ id }` }),
        ),
      ).resolves.toEqual([]);

      {
        await using subscription = await api.Article.subscribeToChanges(
          myAdminContext,
          { selection: { onUpsert: `{ id }` } },
        );

        expect(subscription).toBeInstanceOf(ChangesSubscriptionStream);
      }
    });
  });

  describe('Context-bound API', () => {
    let api: ContextBoundAPI;

    beforeAll(() => {
      api = gp.createContextBoundAPI(myAdminContext);
    });

    it('is callable', async () => {
      await expect(api.Article.count({})).resolves.toEqual(5);

      await expect(
        api.Article.findMany({ first: 5, selection: `{ id }` }),
      ).resolves.toEqual([]);

      await expect(
        Array.fromAsync(api.Article.scroll({ selection: `{ id title }` })),
      ).resolves.toEqual([]);

      {
        await using subscription = await api.Article.subscribeToChanges({
          selection: { onUpsert: `{ id }` },
        });

        expect(subscription).toBeInstanceOf(ChangesSubscriptionStream);
      }
    });
  });
});
