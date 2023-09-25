import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  MyContext,
  MyGP,
  myAdminContext,
  nodes,
} from '../../__tests__/config.js';
import { mockConnector } from '../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../index.js';
import { NodeSubscription } from '../subscription.js';
import { API, ContextBoundAPI } from './api.js';

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
      await expect(api.query.articleCount(myAdminContext, {})).resolves.toEqual(
        5,
      );
      await expect(api.Article.count(myAdminContext, {})).resolves.toEqual(5);

      await expect(
        api.query.articles(myAdminContext, {
          first: 5,
          selection: `{ id }`,
        }),
      ).resolves.toEqual([]);

      await expect(
        api.Article.findMany(myAdminContext, { first: 5, selection: `{ id }` }),
      ).resolves.toEqual([]);

      await expect(
        api.Article.scroll(myAdminContext).toArray(),
      ).resolves.toEqual([]);

      const ac = new AbortController();
      const subscription = api.Article.subscribe(myAdminContext, {
        signal: ac.signal,
      });
      expect(subscription).toBeInstanceOf(NodeSubscription);
      subscription.on('idle', () => ac.abort());
    });
  });

  describe('Context-bound API', () => {
    let api: ContextBoundAPI;

    beforeAll(() => {
      api = gp.createContextBoundAPI(myAdminContext);
    });

    it('is callable', async () => {
      await expect(api.query.articleCount({})).resolves.toEqual(5);
      await expect(api.Article.count({})).resolves.toEqual(5);

      await expect(
        api.query.articles({ first: 5, selection: `{ id }` }),
      ).resolves.toEqual([]);

      await expect(
        api.Article.findMany({ first: 5, selection: `{ id }` }),
      ).resolves.toEqual([]);

      await expect(
        api.Article.scroll({ selection: `{ id title }` }).toArray(),
      ).resolves.toEqual([]);

      const ac = new AbortController();
      const subscription = api.Article.subscribe({ signal: ac.signal });
      expect(subscription).toBeInstanceOf(NodeSubscription);
      subscription.on('idle', () => ac.abort());
    });
  });
});
