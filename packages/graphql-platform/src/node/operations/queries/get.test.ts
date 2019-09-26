import { GraphQLPlatform, IConnectorFindOperationArgs } from '../..';
import {
  myAdminContext,
  MyGP,
  nodes,
  TMyContext,
} from '../../__tests__/config';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../__tests__/connector-mock';
import { OperationContext } from '../context';
import { IGetOperationArgs } from './get';

describe('Get operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ find: jest.fn(async () => []) }),
    });
  });

  beforeEach(() => clearAllConnectorMocks(gp.connector));

  it.each<[string, TMyContext | undefined, IGetOperationArgs]>([
    [
      'Article',
      undefined,
      { where: { id: 'ab9ed4e3-bb4e-454a-865f-548c4b19c785' }, selections: [] },
    ],
  ])(
    'does no call the connector when it is not needed',
    async (nodeName, context, args) => {
      const node = gp.getNode(nodeName);

      await expect(
        node.getOperation('get').execute(args, context),
      ).rejects.toThrowError(
        'An error occurred at "query.article.where" - no "Article" node has been found given the following filter: ',
      );

      expect(gp.connector.find).toHaveBeenCalledTimes(0);
    },
  );

  it.each<
    [
      string,
      TMyContext | undefined,
      IGetOperationArgs,
      IConnectorFindOperationArgs,
    ]
  >([
    [
      'Article',
      myAdminContext,
      { where: { id: 'b5e3fc25-d29b-4871-9a16-6393c98f19da' }, selections: [] },
      {
        filter: {
          kind: 'Leaf',
          leaf: 'id',
          operator: 'eq',
          value: 'b5e3fc25-d29b-4871-9a16-6393c98f19da',
        },
        first: 1,
        selections: [],
      },
    ],
  ])(
    'calls the connector',
    async (nodeName, context, args, connectorFindArgs) => {
      const node = gp.getNode(nodeName);

      await expect(
        node.getOperation('get').execute(args, context),
      ).rejects.toThrowError(
        'An error occurred at "article" - no "Article" node has been found given the following filter: ',
      );

      expect(gp.connector.find).toHaveBeenCalledWith(
        node,
        connectorFindArgs,
        expect.any(OperationContext),
      );
    },
  );
});
