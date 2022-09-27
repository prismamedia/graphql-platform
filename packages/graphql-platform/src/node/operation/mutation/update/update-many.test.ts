import { GraphQLPlatform } from '../../../../index.js';
import {
  myAdminContext,
  MyContext,
  MyGP,
  myVisitorContext,
  nodes,
} from '../../../../__tests__/config.js';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../../__tests__/connector-mock.js';
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
      it.each<[UpdateManyMutationArgs, MyContext]>([
        [{ data: {}, first: 5, selection: '{ id }' }, myVisitorContext],
      ])('throws an UnauthorizedError', async (args, context) => {
        await expect(
          gp.api.mutation.updateArticles(args, context),
        ).rejects.toThrowError(UnauthorizedError);

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
        expect(gp.connector.update).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      it.each<[UpdateManyMutationArgs, MyContext]>([
        [{ data: {}, first: 0, selection: '{ id }' }, myAdminContext],
        [
          { data: {}, where: null, first: 5, selection: '{ id }' },
          myAdminContext,
        ],
      ])(
        'does no call the connector when it is not needed',
        async (args, context) => {
          await expect(
            gp.api.mutation.updateArticles(args, context),
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
