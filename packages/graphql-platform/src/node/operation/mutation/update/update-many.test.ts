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
      it.each([myVisitorContext, myUserContext])(
        'throws an error on unauthorized node',
        async (context) => {
          await expect(
            gp.api.mutation.updateArticles(undefined, context),
          ).rejects.toThrowError(
            '"mutation.updateArticles" - Unauthorized access to "Article"',
          );

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
          expect(gp.connector.update).toHaveBeenCalledTimes(0);
        },
      );
    });

    describe('Works', () => {
      it.each<[UpdateManyMutationArgs, MyContext]>([
        [
          { where: null, first: 5, data: {}, selection: '{ id }' },
          myAdminContext,
        ],
        [{ first: 0, data: {}, selection: '{ id }' }, myAdminContext],
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
