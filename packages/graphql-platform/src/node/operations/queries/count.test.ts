import { GraphQLPlatform } from '../..';
import { MyGP, nodes, TMyContext } from '../../__tests__/config';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../__tests__/connector-mock';
import { ICountOperationArgs } from './count';

describe('Count operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ count: jest.fn(async () => 0) }),
    });
  });

  beforeEach(() => clearAllConnectorMocks(gp.connector));

  it.each<[string, TMyContext | undefined, ICountOperationArgs]>([
    // "OR: []" is transformed in "false" so the connector is never called
    ['Article', undefined, { where: { OR: [] } }],

    // With an "undefined" context, the Article's filter returns "false" so the connector is never called
    ['Article', undefined, {}],
  ])(
    'does no call the connector when it is not needed',
    async (nodeName, context, args) => {
      const node = gp.getNode(nodeName);

      await expect(
        node.getOperation('count').execute(args, context),
      ).resolves.toEqual(0);

      expect(gp.connector.count).toHaveBeenCalledTimes(0);
    },
  );

  it('calls the connector', async () => {});
});
