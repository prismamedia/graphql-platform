import { GraphQLPlatform } from '../../..';
import {
  models,
  MyContext,
  MyGP,
  myVisitorContext,
} from '../../../__tests__/config';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../../__tests__/connector-mock';
import { GetOneOperationArgs } from './get-one';

describe('GetOne operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      models,
      connector: mockConnector({ find: jest.fn(async () => []) }),
    });
  });

  beforeEach(() => clearAllConnectorMocks(gp.connector));

  it.each<[string, MyContext, GetOneOperationArgs]>([
    [
      'Article',
      myVisitorContext,
      {
        where: { id: 'ab9ed4e3-bb4e-454a-865f-548c4b19c785' },
        selection: '{ id }',
      },
    ],
  ])(
    'does no call the connector when it is not needed',
    async (modelName, context, args) => {
      await expect(gp.api.get(modelName, args, context)).rejects.toThrowError(
        'An error occurred at "query.article" - no "Article" node has been found given the following filter: ',
      );

      expect(gp.connector.find).toHaveBeenCalledTimes(0);
    },
  );

  // it.each<
  //   [
  //     string,
  //     MyContext | undefined,
  //     GetOperationArgs,
  //     ConnectorFindOperationArgs,
  //   ]
  // >([
  //   [
  //     'Article',
  //     myAdminContext,
  //     {
  //       where: { id: 'b5e3fc25-d29b-4871-9a16-6393c98f19da' },
  //       selection: '{ id }',
  //     },
  //     {
  //       filter: {
  //         kind: 'Leaf',
  //         leaf: 'id',
  //         operator: 'eq',
  //         value: 'b5e3fc25-d29b-4871-9a16-6393c98f19da',
  //       },
  //       sorts: [
  //         {
  //           kind: 'Leaf',
  //           leaf: 'createdAt',
  //           direction: 'DESC',
  //         },
  //       ],
  //       first: 1,
  //       selection: {
  //         node: 'Article',
  //         fields: [{ kind: 'Leaf', name: 'id' }],
  //       },
  //     },
  //   ],
  // ])(
  //   'calls the connector',
  //   async (modelName, context, args, connectorFindArgs) => {
  //     const model = gp.getModel(modelName);

  //     await expect(
  //       model.getOperation('get').execute(args, context),
  //     ).rejects.toThrowError(
  //       'An error occurred at "query.article" - no "Article" node has been found given the following filter: ',
  //     );

  //     expect(gp.connector.find).toHaveBeenCalledWith(
  //       model,
  //       connectorFindArgs,
  //       expect.any(OperationContext),
  //     );
  //   },
  // );
});
