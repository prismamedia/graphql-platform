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
  NodeSelection,
  OperationContext,
} from '../../../index.js';
import { NodeFilter, NodeOrdering } from '../../statement.js';
import { UnauthorizedError } from '../error.js';
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
      it.each<[MyContext, FindManyQueryArgs]>([
        [myVisitorContext, { first: 5, selection: ['id'] }],
      ])('throws an UnauthorizedError', (context, args) => {
        expect(() => gp.api.query.articles(context, args)).toThrowError(
          UnauthorizedError,
        );

        expect(gp.connector.find).toHaveBeenCalledTimes(0);
      });
    });

    describe('Works', () => {
      it.each<[MyContext, FindManyQueryArgs]>([
        [myAdminContext, { where: null, first: 5, selection: '{ id }' }],
        [myAdminContext, { first: 0, selection: '{ id }' }],
      ])(
        'does no call the connector when it is not needed',
        async (context, args) => {
          await expect(gp.api.query.articles(context, args)).resolves.toEqual(
            [],
          );

          expect(gp.connector.find).toHaveBeenCalledTimes(0);
        },
      );

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articles(myAdminContext, {
            first: 10,
            selection: '{ id }',
          }),
        ).resolves.toEqual([]);

        expect(gp.connector.find).toHaveBeenCalledTimes(1);
        expect(gp.connector.find).toHaveBeenLastCalledWith(
          expect.any(OperationContext),
          {
            node: gp.getNodeByName('Article'),
            limit: 10,
            selection: expect.any(NodeSelection),
          },
        );
      });

      it('calls the connector properly', async () => {
        await expect(
          gp.api.query.articles(myAdminContext, {
            where: { tagCount_gt: 0 },
            orderBy: ['_id_DESC'],
            skip: 5,
            first: 10,
            selection:
              '{ id tags(orderBy: [order_ASC], first: 5) { tag { title } } }',
          }),
        ).resolves.toEqual([]);

        expect(gp.connector.find).toHaveBeenCalledTimes(1);
        expect(gp.connector.find).toHaveBeenLastCalledWith(
          expect.any(OperationContext),
          {
            node: gp.getNodeByName('Article'),
            filter: expect.any(NodeFilter),
            ordering: expect.any(NodeOrdering),
            offset: 5,
            limit: 10,
            selection: expect.any(NodeSelection),
          },
        );
      });
    });
  });
});
