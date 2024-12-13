import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  MyContext,
  MyGP,
  myAdminContext,
  myVisitorContext,
  nodes,
} from '../../../__tests__/config.js';
import {
  clearConnectorMockCalls,
  mockConnector,
  type MockedConnector,
} from '../../../__tests__/connector-mock.js';
import { GraphQLPlatform } from '../../../index.js';
import { OperationContext } from '../../operation.js';
import { NodeFilter, NodeOrdering, NodeSelection } from '../../statement.js';
import { UnauthorizedError } from '../error.js';
import { FindManyQueryArgs } from './find-many.js';

describe('FindManyQuery', () => {
  const gp: MyGP<MockedConnector> = new GraphQLPlatform({
    nodes,
    connector: mockConnector({ find: async () => [] }),
  });

  beforeEach(() => clearConnectorMockCalls(gp.connector));

  describe('Fails', () => {
    (
      [
        [myVisitorContext, { first: 5, selection: ['id'] }],
      ] satisfies ReadonlyArray<[MyContext, FindManyQueryArgs]>
    ).forEach(([context, args]) => {
      it('throws an UnauthorizedError', async () => {
        await assert.rejects(
          () => gp.api.Article.findMany(context, args),
          UnauthorizedError,
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });
  });

  describe('Works', () => {
    (
      [
        [myAdminContext, { where: null, first: 5, selection: '{ id }' }],
        [myAdminContext, { first: 0, selection: '{ id }' }],
      ] satisfies ReadonlyArray<[MyContext, FindManyQueryArgs]>
    ).forEach(([context, args]) => {
      it('does no call the connector when it is not needed', async () => {
        assert.deepStrictEqual(
          await gp.api.Article.findMany(context, args),
          [],
        );

        assert.strictEqual(gp.connector.find.mock.callCount(), 0);
      });
    });

    it('calls the connector properly', async () => {
      assert.deepStrictEqual(
        await gp.api.Article.findMany(myAdminContext, {
          first: 10,
          selection: '{ id }',
        }),
        [],
      );

      assert.strictEqual(gp.connector.find.mock.callCount(), 1);
      assert.strictEqual(gp.connector.find.mock.calls[0].arguments.length, 2);

      const [context, { node, filter, ordering, offset, limit, selection }] =
        gp.connector.find.mock.calls[0].arguments;

      assert(context instanceof OperationContext);
      assert.strictEqual(node, gp.getNodeByName('Article'));
      assert.strictEqual(offset, undefined);
      assert.strictEqual(limit, 10);
      assert.strictEqual(filter, undefined);
      assert.strictEqual(ordering, undefined);
      assert(selection instanceof NodeSelection);
    });

    it('calls the connector properly', async () => {
      assert.deepStrictEqual(
        await gp.api.Article.findMany(myAdminContext, {
          where: { tagCount_gt: 0 },
          orderBy: ['_id_DESC'],
          skip: 5,
          first: 10,
          selection:
            '{ id tags(orderBy: [order_ASC], first: 5) { tag { title } } }',
        }),
        [],
      );

      assert.strictEqual(gp.connector.find.mock.callCount(), 1);
      assert.strictEqual(gp.connector.find.mock.calls[0].arguments.length, 2);

      const [context, { node, filter, ordering, offset, limit, selection }] =
        gp.connector.find.mock.calls[0].arguments;

      assert(context instanceof OperationContext);
      assert.strictEqual(node, gp.getNodeByName('Article'));
      assert.strictEqual(offset, 5);
      assert.strictEqual(limit, 10);
      assert(filter instanceof NodeFilter);
      assert(ordering instanceof NodeOrdering);
      assert(selection instanceof NodeSelection);
    });
  });
});
