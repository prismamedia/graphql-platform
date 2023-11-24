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
import {
  ConnectorOperationError,
  ConnectorWorkflowError,
  LifecycleHookError,
  UnauthorizedError,
} from '../../error.js';
import { CreateSomeMutationArgs } from './create-some.js';

describe('CreateSomeMutation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({
        find: async () => [],
      }),
    });
  });

  describe.skip('Definition', () => {});

  describe('Runtime', () => {
    beforeEach(() => clearAllConnectorMocks(gp.connector));

    describe('Fails', () => {
      it.each<[MyContext, CreateSomeMutationArgs]>([
        [
          myVisitorContext,
          { data: [{ title: 'A title' }], selection: '{ id }' },
        ],
      ])('throws an UnauthorizedError', async (context, args) => {
        await expect(() =>
          gp.api.mutation.createArticles(context, args),
        ).rejects.toThrowError(UnauthorizedError);

        expect(gp.connector.create).toHaveBeenCalledTimes(0);
      });

      it('throws a ConnectorFlowError', async () => {
        const gp = new GraphQLPlatform({
          nodes,
          connector: mockConnector({
            preMutation: async () => {
              throw new Error('No connection available');
            },
          }),
        });

        await expect(
          gp.api.mutation.createArticles(myAdminContext, {
            data: [
              {
                title: "My first article's title",
              },
              {
                title: "My second article's title",
              },
            ],
            selection: '{ id }',
          }),
        ).rejects.toThrowError(ConnectorWorkflowError);
      });

      it('throws a ConnectorOperationError', async () => {
        const gp = new GraphQLPlatform({
          nodes,
          connector: mockConnector({
            create: async () => {
              throw new Error('Failed to create');
            },
          }),
        });

        await expect(
          gp.api.mutation.createTags(myAdminContext, {
            data: [
              {
                title: "My first tag's title",
              },
              {
                title: "My second tag's title",
              },
            ],
            selection: '{ id }',
          }),
        ).rejects.toThrowError(ConnectorOperationError);
      });

      it('throws a LifecycleHookError', async () => {
        await expect(
          gp.api.mutation.createArticles(myAdminContext, {
            data: [
              {
                title: "My first article's title",
                htmlBody: '<p>body</p>',
                body: { blocks: [] },
              },
              {
                title: "My second article's title",
                htmlBody: '<p>body</p>',
                body: { blocks: [] },
              },
            ],
            selection: '{ id }',
          }),
        ).rejects.toThrowError(LifecycleHookError);
      });
    });

    describe('Works', () => {
      it.each<[MyContext, CreateSomeMutationArgs]>([
        [myAdminContext, { data: [], selection: '{ id }' }],
      ])(
        'does no call the connector when it is not needed',
        async (context, args) => {
          await expect(
            gp.api.mutation.createArticles(context, args),
          ).resolves.toEqual([]);

          expect(gp.connector.create).toHaveBeenCalledTimes(0);
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
      //
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
