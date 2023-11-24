import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import {
  MyContext,
  MyGP,
  myAdminContext,
  myUserContext,
  myVisitorContext,
  nodes,
} from '../../../../__tests__/config.js';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../../index.js';
import { UnauthorizedError } from '../../error.js';
import { DeleteManyMutationArgs } from './delete-many.js';

describe('DeleteManyMutation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ find: async () => [], delete: async () => 0 }),
    });
  });

  describe.skip('Definition', () => {});

  describe('Runtime', () => {
    beforeEach(() => clearAllConnectorMocks(gp.connector));

    describe('Fails', () => {
      it.each<[MyContext, DeleteManyMutationArgs]>([
        [myVisitorContext, { first: 5, selection: '{ id }' }],
        [myUserContext, { first: 5, selection: '{ id }' }],
      ])('throws an UnauthorizedError', async (context, args) => {
        await expect(() =>
          gp.api.mutation.deleteArticles(context, args),
        ).rejects.toThrowError(UnauthorizedError);

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
        expect(gp.connector.delete).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      it.each<[MyContext, DeleteManyMutationArgs]>([
        [myAdminContext, { first: 0, selection: '{ id }' }],
        [myAdminContext, { where: null, first: 5, selection: '{ id }' }],
      ])(
        'does no call the connector when it is not needed',
        async (context, args) => {
          await expect(
            gp.api.mutation.deleteArticles(context, args),
          ).resolves.toEqual([]);

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
          expect(gp.connector.delete).toHaveBeenCalledTimes(0);
        },
      );
    });
  });
});
