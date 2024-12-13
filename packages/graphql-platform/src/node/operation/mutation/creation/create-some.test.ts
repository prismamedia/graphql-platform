import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  MyContext,
  MyGP,
  myAdminContext,
  myVisitorContext,
  nodes,
} from '../../../../__tests__/config.js';
import {
  clearConnectorMockCalls,
  mockConnector,
  type MockedConnector,
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
  const gp: MyGP<MockedConnector> = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ find: async () => [] }),
  });

  beforeEach(() => clearConnectorMockCalls(gp.connector));

  describe('Fails', () => {
    (
      [
        [
          myVisitorContext,
          { data: [{ title: 'A title' }], selection: '{ id }' },
        ],
      ] satisfies ReadonlyArray<[MyContext, CreateSomeMutationArgs]>
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', async () => {
        await assert.rejects(
          () => gp.api.Article.createSome(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.create.mock.callCount(), 0);
      });
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

      await assert.rejects(
        gp.api.Article.createSome(myAdminContext, {
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
        ConnectorWorkflowError,
      );

      assert.strictEqual(gp.connector.create.mock.callCount(), 0);
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

      await assert.rejects(
        gp.api.Tag.createSome(myAdminContext, {
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
        ConnectorOperationError,
      );

      assert.strictEqual(gp.connector.create.mock.callCount(), 1);
    });

    it('throws a LifecycleHookError', async () => {
      await assert.rejects(
        gp.api.Article.createSome(myAdminContext, {
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
        LifecycleHookError,
      );
    });
  });

  describe('Works', () => {
    (
      [
        [myAdminContext, { data: [], selection: '{ id }' }],
      ] satisfies ReadonlyArray<[MyContext, CreateSomeMutationArgs]>
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        assert.deepStrictEqual(
          await gp.api.Article.createSome(context, args),
          [],
        );

        assert.strictEqual(gp.connector.create.mock.callCount(), 0);
      });
    });

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
