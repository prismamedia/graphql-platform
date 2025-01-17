import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  myAdminContext,
  myVisitorContext,
  nodes,
  type MyContext,
  type MyGP,
} from '../../../__tests__/config.js';
import {
  clearConnectorMockCalls,
  mockConnector,
  type MockedConnector,
} from '../../../__tests__/connector-mock.js';
import {
  GraphQLPlatform,
  NodeFilter,
  OperationContext,
} from '../../../index.js';
import { UnauthorizedError } from '../error.js';
import type { CountQueryArgs } from './count.js';

describe('CountQuery', () => {
  const gp: MyGP<MockedConnector> = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ count: async () => 5 }),
  });

  beforeEach(() => clearConnectorMockCalls(gp.connector));

  describe('Fails', () => {
    (
      [[myVisitorContext, undefined]] satisfies ReadonlyArray<
        [MyContext, CountQueryArgs]
      >
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', async () => {
        await assert.rejects(
          () => gp.api.Article.count(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.count.mock.callCount(), 0);
      });
    });
  });

  describe('Works', () => {
    (
      [[myAdminContext, { where: null }]] satisfies ReadonlyArray<
        [MyContext, CountQueryArgs]
      >
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        assert.strictEqual(await gp.api.Article.count(context, args), 0);

        assert.strictEqual(gp.connector.count.mock.callCount(), 0);
      });
    });

    it('calls the connector properly', async () => {
      assert.strictEqual(await gp.api.Article.count(myAdminContext, {}), 5);

      assert.strictEqual(gp.connector.count.mock.callCount(), 1);
      assert.strictEqual(gp.connector.count.mock.calls[0].arguments.length, 2);

      const [context, { node, filter }] =
        gp.connector.count.mock.calls[0].arguments;

      assert(context instanceof OperationContext);
      assert.strictEqual(node, gp.getNodeByName('Article'));
      assert.strictEqual(filter, undefined);
    });

    it('calls the connector properly', async () => {
      assert.strictEqual(
        await gp.api.Article.count(myAdminContext, {
          where: { tagCount_gt: 0 },
        }),
        5,
      );

      assert.strictEqual(gp.connector.count.mock.callCount(), 1);
      assert.strictEqual(gp.connector.count.mock.calls[0].arguments.length, 2);

      const [context, { node, filter }] =
        gp.connector.count.mock.calls[0].arguments;

      assert(context instanceof OperationContext);
      assert.strictEqual(node, gp.getNodeByName('Article'));
      assert(filter instanceof NodeFilter);
    });
  });
});
