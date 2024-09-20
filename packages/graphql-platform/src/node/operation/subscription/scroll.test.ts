import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  MyContext,
  MyGP,
  myAdminContext,
  myVisitorContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../__tests__/connector-mock.js';
import { GraphQLPlatform, Node } from '../../../index.js';
import { UnauthorizedError } from '../error.js';
import { ScrollSubscriptionArgs, ScrollSubscriptionStream } from './scroll.js';

describe('ScrollSubscription', () => {
  let gp: MyGP;
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

  describe('Runtime', () => {
    beforeEach(() => clearAllConnectorMocks(gp.connector));

    describe('Fails', () => {
      it.each<[MyContext, ScrollSubscriptionArgs]>([
        [myVisitorContext, { selection: `{ id }` }],
      ])('throws an UnauthorizedError', (context, args) => {
        expect(() => Article.api.scroll(context, args)).toThrow(
          UnauthorizedError,
        );

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      it.each<[MyContext, ScrollSubscriptionArgs]>([
        [myAdminContext, { where: null, selection: `{ id }` }],
      ])(
        'does no call the connector when it is not needed',
        async (context, args) => {
          const scroll = Article.api.scroll(context, args);
          expect(scroll).toBeInstanceOf(ScrollSubscriptionStream);

          await expect(scroll.toArray()).resolves.toEqual([]);
          expect(gp.connector.find).toHaveBeenCalledTimes(0);
        },
      );

      it('scrolls articles', async () => {
        const cursor = Article.api.scroll(myAdminContext, {
          selection: '{ _id id }',
        });

        await expect(cursor.toArray()).resolves.toEqual(articles);
        expect(gp.connector.find).toHaveBeenCalledTimes(1);
      });

      it('scrolls articles, 2 by 2', async () => {
        const cursor = Article.api.scroll(myAdminContext, {
          selection: '{ _id id }',
          chunkSize: 2,
        });

        await expect(cursor.toArray()).resolves.toEqual(articles);
        expect(gp.connector.find).toHaveBeenCalledTimes(3);
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

        expect(gp.connector.find).toHaveBeenCalledTimes(1);
      });
    });
  });
});
