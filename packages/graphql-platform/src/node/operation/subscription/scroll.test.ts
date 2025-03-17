import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import {
  myAdminContext,
  type MyContext,
  type MyGP,
  myVisitorContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  mockConnector,
  type MockedConnector,
} from '../../../__tests__/connector-mock.js';
import { GraphQLPlatform, Node } from '../../../index.js';
import { UnauthorizedError } from '../error.js';
import {
  type ScrollSubscriptionArgs,
  ScrollSubscriptionStream,
} from './scroll.js';

describe('ScrollSubscription', () => {
  let gp: MyGP<MockedConnector>;
  let Article: Node;
  const articles = [
    { _id: 1, id: 'ca001c1c-2e90-461f-96c8-658afa089728' },
    { _id: 3, id: 'c4f05098-9484-4a2f-b82a-60c3a5d54ec6' },
    { _id: 5, id: '3d0dc22d-0175-462c-afda-70be8702e1b7' },
    { _id: 7, id: '51bea59b-5d26-4a57-ad7f-75f6d35d7fa0' },
    { _id: 8, id: '4e3add0b-1db3-47e7-8342-fedeedc3388f' },
  ] as const;

  beforeEach(() => {
    let callIndex: number = 0;

    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({
        async find(_context, { limit }): Promise<any> {
          const chunk = articles.slice(
            callIndex * limit,
            (callIndex + 1) * limit,
          );

          callIndex++;

          return chunk;
        },
      }),
    });

    Article = gp.getNodeByName('Article');
  });

  describe('Fails', () => {
    (
      [[myVisitorContext, { selection: `{ id }` }]] satisfies ReadonlyArray<
        [MyContext, ScrollSubscriptionArgs]
      >
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', () => {
        assert.throws(
          () => gp.api.Article.scroll(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });

    it("throws on forEach's callback synchronous error on first call", async () => {
      await assert.rejects(
        () =>
          gp.api.Article.scroll(myAdminContext, {
            selection: `{ _id }`,
          }).forEach(
            (_value, index) => {
              if (index === 0) {
                throw new Error('Synchronous error');
              }
            },
            { concurrency: 2 },
          ),
        { message: 'Synchronous error' },
      );
    });

    it("throws on forEach's callback synchronous error on second call", async () => {
      await assert.rejects(
        () =>
          gp.api.Article.scroll(myAdminContext, {
            selection: `{ _id }`,
          }).forEach(
            (_value, index) => {
              if (index === 1) {
                throw new Error('Synchronous error');
              }
            },
            { concurrency: 2 },
          ),
        { message: 'Synchronous error' },
      );
    });

    it("throws on forEach's callback asynchronous error on first call", async () => {
      await assert.rejects(
        () =>
          gp.api.Article.scroll(myAdminContext, {
            selection: `{ _id }`,
          }).forEach(
            async (_value, index, signal) => {
              await setTimeout(25, undefined, { signal });

              if (index === 0) {
                throw new Error('Asynchronous error');
              }
            },
            { concurrency: 2 },
          ),
        { message: 'Asynchronous error' },
      );
    });

    it("throws on forEach's callback asynchronous error on second call", async () => {
      await assert.rejects(
        () =>
          gp.api.Article.scroll(myAdminContext, {
            selection: `{ _id }`,
          }).forEach(
            async (_value, index, signal) => {
              await setTimeout(25, undefined, { signal });

              if (index === 1) {
                throw new Error('Asynchronous error');
              }
            },
            { concurrency: 2 },
          ),
        { message: 'Asynchronous error' },
      );
    });

    it("throws on byBatch's callback synchronous error on first call", async () => {
      await assert.rejects(
        () =>
          gp.api.Article.scroll(myAdminContext, {
            selection: `{ _id }`,
          }).byBatch(
            async (_values, signal) => {
              await setTimeout(25, undefined, { signal });

              throw new Error('Synchronous error');
            },
            { batchSize: 2 },
          ),
        { message: 'Synchronous error' },
      );
    });
  });

  describe('Works', () => {
    (
      [
        [myAdminContext, { where: null, selection: `{ id }` }],
      ] satisfies ReadonlyArray<[MyContext, ScrollSubscriptionArgs]>
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        const cursor = Article.api.scroll(context, args);
        assert(cursor instanceof ScrollSubscriptionStream);

        assert.deepEqual(await Array.fromAsync(cursor), []);
        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });

    it('scrolls articles', async () => {
      const cursor = Article.api.scroll(myAdminContext, {
        selection: '{ _id id }',
      });

      assert.deepEqual(await Array.fromAsync(cursor), articles);
      assert.strictEqual(gp.connector.find.mock.callCount(), 1);
    });

    it('scrolls articles, 2 by 2', async () => {
      const cursor = Article.api.scroll(myAdminContext, {
        selection: '{ _id id }',
        chunkSize: 2,
      });

      assert.deepEqual(await Array.fromAsync(cursor), articles);
      assert.strictEqual(gp.connector.find.mock.callCount(), 3);
    });

    it('stops a cursor through for-await-of', async () => {
      const cursor = Article.api.scroll(myAdminContext, {
        selection: '{ _id id }',
        chunkSize: 2,
      });

      for await (const value of cursor) {
        if (value._id >= 3) {
          break;
        }
      }

      assert.strictEqual(gp.connector.find.mock.callCount(), 1);
    });
  });
});
