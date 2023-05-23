import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import {
  MyContext,
  MyGP,
  myAdminContext,
  myVisitorContext,
  nodes,
} from '../../../../__tests__/config.js';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../../index.js';
import { UnauthorizedError } from '../../error.js';
import { UpdateManyMutationArgs } from './update-many.js';

describe('UpdateManyMutation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ update: async () => 0 }),
    });
  });

  describe.skip('Definition', () => {});

  describe('Runtime', () => {
    beforeEach(() => clearAllConnectorMocks(gp.connector));

    describe('Fails', () => {
      it.each<[MyContext, UpdateManyMutationArgs]>([
        [myVisitorContext, { data: {}, first: 5, selection: '{ id }' }],
      ])('throws an UnauthorizedError', async (context, args) => {
        await expect(
          gp.api.mutation.updateArticles(context, args),
        ).rejects.toThrowError(UnauthorizedError);

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
        expect(gp.connector.update).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      it.each<[MyContext, UpdateManyMutationArgs]>([
        [myAdminContext, { data: {}, first: 0, selection: '{ id }' }],
        [
          myAdminContext,
          { data: {}, where: null, first: 5, selection: '{ id }' },
        ],
      ])(
        'does no call the connector when it is not needed',
        async (context, args) => {
          await expect(
            gp.api.mutation.updateArticles(context, args),
          ).resolves.toEqual([]);

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
          expect(gp.connector.update).toHaveBeenCalledTimes(0);
        },
      );

      // it('calls the connector properly', async () => {
      //   await expect(
      //     gp.api.query.articleCount({}, myAdminContext),
      //   ).resolves.toEqual(0);
      //   expect(gp.connector.count).toHaveBeenCalledTimes(1);
      //   expect(gp.connector.count).toHaveBeenLastCalledWith(
      //     gp.getNode('Article'),
      //     {},
      //     expect.any(OperationContext),
      //   );
      // });
      // it('calls the connector properly', async () => {
      //   await expect(
      //     gp.api.query.articleCount(
      //       { where: { tagCount_gt: 0 } },
      //       myAdminContext,
      //     ),
      //   ).resolves.toEqual(0);
      //   expect(gp.connector.count).toHaveBeenCalledTimes(1);
      //   expect(gp.connector.count).toHaveBeenLastCalledWith(
      //     gp.getNode('Article'),
      //     { where: expect.any(NodeFilter) },
      //     expect.any(OperationContext),
      //   );
      // });
    });
  });
});
