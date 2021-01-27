import { GraphQLPlatform } from '../../..';
import {
  models,
  myAdminContext,
  MyContext,
  MyGP,
  myVisitorContext,
} from '../../../__tests__/config';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../__tests__/connector-mock';
import { CountOperationArgs } from './count';

describe('Count operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      models,
      connector: mockConnector({ count: jest.fn(async () => 0) }),
    });
  });

  beforeEach(() => clearAllConnectorMocks(gp.connector));

  it.each<[string, MyContext, CountOperationArgs]>([
    // "OR: []" is transformed in "false" so the connector is never called
    ['Article', myAdminContext, { where: { OR: [] } }],

    // With a "visitor", the Article's filter returns "false" so the connector is never called
    ['Article', myVisitorContext, {}],
  ])(
    'does no call the connector when it is not needed',
    async (modelName, context, args) => {
      await expect(gp.api.count(modelName, args, context)).resolves.toEqual(0);

      expect(gp.connector.count).toHaveBeenCalledTimes(0);
    },
  );

  // it('calls the connector', async () => {});
});
