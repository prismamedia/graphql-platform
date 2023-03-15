import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import {
  GraphQLPlatform,
  NodeFilter,
  OperationContext,
} from '../../../index.js';
import {
  myAdminContext,
  MyContext,
  MyGP,
  myVisitorContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../__tests__/connector-mock.js';
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
      it.each<[CountQueryArgs, MyContext]>([[undefined, myVisitorContext]])(
        'throws an UnauthorizedError',
        async (args, context) => {
          await expect(
            gp.api.query.articleCount(args, context),
          ).rejects.toThrowError(UnauthorizedError);

          expect(gp.connector.count).toHaveBeenCalledTimes(0);
        },
      );
    });

    describe('Works', () => {
      it.each<[CountQueryArgs, MyContext]>([[{ where: null }, myAdminContext]])(
        'does no call the connector when it is not needed',
        async (args, context) => {
          await expect(
            gp.api.query.articleCount(args, context),
          ).resolves.toEqual(0);

          expect(gp.connector.count).toHaveBeenCalledTimes(0);
        },
      );

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articleCount({}, myAdminContext),
        ).resolves.toEqual(5);

        expect(gp.connector.count).toHaveBeenCalledTimes(1);
        expect(gp.connector.count).toHaveBeenLastCalledWith(
          { node: gp.getNodeByName('Article') },
          expect.any(OperationContext),
        );
      });

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articleCount(
            { where: { tagCount_gt: 0 } },
            myAdminContext,
          ),
        ).resolves.toEqual(5);

        expect(gp.connector.count).toHaveBeenCalledTimes(1);
        expect(gp.connector.count).toHaveBeenLastCalledWith(
          { node: gp.getNodeByName('Article'), filter: expect.any(NodeFilter) },
          expect.any(OperationContext),
        );
      });
    });
  });
});
