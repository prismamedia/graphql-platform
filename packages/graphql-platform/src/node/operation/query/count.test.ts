import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
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
import {
  GraphQLPlatform,
  NodeFilter,
  OperationContext,
} from '../../../index.js';
import { UnauthorizedError } from '../error.js';
import { CountQueryArgs } from './count.js';

describe('CountQuery', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ count: async () => 5 }),
    });
  });

  describe.skip('Definition', () => {});

  describe('Runtime', () => {
    beforeEach(() => clearAllConnectorMocks(gp.connector));

    describe('Fails', () => {
      it.each<[MyContext, CountQueryArgs]>([[myVisitorContext, undefined]])(
        'throws an UnauthorizedError',
        async (context, args) => {
          await expect(
            gp.api.query.articleCount(context, args),
          ).rejects.toThrowError(UnauthorizedError);

          expect(gp.connector.count).toHaveBeenCalledTimes(0);
        },
      );
    });

    describe('Works', () => {
      it.each<[MyContext, CountQueryArgs]>([[myAdminContext, { where: null }]])(
        'does no call the connector when it is not needed',
        async (context, args) => {
          await expect(
            gp.api.query.articleCount(context, args),
          ).resolves.toEqual(0);

          expect(gp.connector.count).toHaveBeenCalledTimes(0);
        },
      );

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articleCount(myAdminContext, {}),
        ).resolves.toEqual(5);

        expect(gp.connector.count).toHaveBeenCalledTimes(1);
        expect(gp.connector.count).toHaveBeenLastCalledWith(
          expect.any(OperationContext),
          { node: gp.getNodeByName('Article') },
        );
      });

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articleCount(myAdminContext, {
            where: { tagCount_gt: 0 },
          }),
        ).resolves.toEqual(5);

        expect(gp.connector.count).toHaveBeenCalledTimes(1);
        expect(gp.connector.count).toHaveBeenLastCalledWith(
          expect.any(OperationContext),
          { node: gp.getNodeByName('Article'), filter: expect.any(NodeFilter) },
        );
      });
    });
  });
});
