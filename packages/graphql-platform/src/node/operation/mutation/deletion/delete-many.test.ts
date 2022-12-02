import { GraphQLPlatform } from '../../../../index.js';
import {
  myAdminContext,
  MyContext,
  MyGP,
  myUserContext,
  myVisitorContext,
  nodes,
} from '../../../../__tests__/config.js';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../../__tests__/connector-mock.js';
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
      it.each<[DeleteManyMutationArgs, MyContext]>([
        [{ first: 5, selection: '{ id }' }, myVisitorContext],
        [{ first: 5, selection: '{ id }' }, myUserContext],
      ])('throws an UnauthorizedError', async (args, context) => {
        await expect(
          gp.api.mutation.deleteArticles(args, context),
        ).rejects.toThrowError(UnauthorizedError);

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
        expect(gp.connector.delete).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      it.each<[DeleteManyMutationArgs, MyContext]>([
        [{ first: 0, selection: '{ id }' }, myAdminContext],
        [{ where: null, first: 5, selection: '{ id }' }, myAdminContext],
      ])(
        'does no call the connector when it is not needed',
        async (args, context) => {
          await expect(
            gp.api.mutation.deleteArticles(args, context),
          ).resolves.toEqual([]);

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
          expect(gp.connector.delete).toHaveBeenCalledTimes(0);
        },
      );
    });
  });
});