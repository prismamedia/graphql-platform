import {
  GraphQLPlatform,
  NodeSelection,
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
import { NodeFilter, NodeOrdering } from '../../statement.js';
import { FindManyQueryArgs } from './find-many.js';

describe('FindManyQuery', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ find: async () => [] }),
    });
  });

  describe.skip('Definition', () => {});

  describe('Runtime', () => {
    beforeEach(() => clearAllConnectorMocks(gp.connector));

    describe('Fails', () => {
      it('throws an error on unauthorized node', async () => {
        await expect(
          gp.api.query.articles(
            { first: 5, selection: ['id'] },
            myVisitorContext,
          ),
        ).rejects.toThrowError(
          '"query.articles" - Unauthorized access to "Article"',
        );

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      it.each<[FindManyQueryArgs, MyContext]>([
        [{ where: null, first: 5, selection: '{ id }' }, myAdminContext],
        [{ first: 0, selection: '{ id }' }, myAdminContext],
      ])(
        'does no call the connector when it is not needed',
        async (args, context) => {
          await expect(gp.api.query.articles(args, context)).resolves.toEqual(
            [],
          );

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
        },
      );

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articles(
            { first: 10, selection: '{ id }' },
            myAdminContext,
          ),
        ).resolves.toEqual([]);

        expect(gp.connector.find).toHaveBeenCalledTimes(1);
        expect(gp.connector.find).toHaveBeenLastCalledWith(
          {
            node: gp.getNode('Article'),
            limit: 10,
            selection: expect.any(NodeSelection),
          },
          expect.any(OperationContext),
        );
      });

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articles(
            {
              where: { tagCount_gt: 0 },
              orderBy: ['_id_DESC'],
              skip: 5,
              first: 10,
              selection:
                '{ id tags(orderBy: [order_ASC], first: 5) { tag { title } } }',
            },
            myAdminContext,
          ),
        ).resolves.toEqual([]);

        expect(gp.connector.find).toHaveBeenCalledTimes(1);
        expect(gp.connector.find).toHaveBeenLastCalledWith(
          {
            node: gp.getNode('Article'),
            where: expect.any(NodeFilter),
            orderBy: expect.any(NodeOrdering),
            offset: 5,
            limit: 10,
            selection: expect.any(NodeSelection),
          },
          expect.any(OperationContext),
        );
      });
    });
  });
});
