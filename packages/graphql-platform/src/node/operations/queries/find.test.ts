import { GraphQLPlatform, IConnectorFindOperationArgs } from '../..';
import {
  myAdminContext,
  MyGP,
  myJournalistContext,
  nodes,
  TMyContext,
} from '../../__tests__/config';
import {
  clearAllConnectorMocks,
  mockConnector,
} from '../../__tests__/connector-mock';
import { OperationContext } from '../context';
import { IFindOperationArgs } from './find';

describe('Find operation', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({ find: jest.fn(async () => []) }),
    });
  });

  beforeEach(() => clearAllConnectorMocks(gp.connector));

  it.each<[string, TMyContext | undefined, IFindOperationArgs]>([
    // "OR: []" is transformed in "false" so the connector is never called
    ['Article', undefined, { where: { OR: [] }, first: 1, selections: [] }],

    // With an "undefined" context, the Article's filter returns "false" so the connector is never called
    ['Article', undefined, { first: 5, selections: [] }],
  ])(
    'does no call the connector when it is not needed',
    async (nodeName, context, args) => {
      const node = gp.getNode(nodeName);

      await expect(
        node.getOperation('find').execute(args, context),
      ).resolves.toEqual([]);

      expect(gp.connector.find).toHaveBeenCalledTimes(0);
    },
  );

  it.each<
    [
      string,
      TMyContext | undefined,
      IFindOperationArgs,
      IConnectorFindOperationArgs,
    ]
  >([
    // Given an "ADMIN" user in the context, the Article's filter returns "true" and the default Article's find operation args applies
    [
      'Article',
      myAdminContext,
      <any>{ selections: [{ kind: 'Leaf', name: 'id' }] },
      {
        filter: {
          kind: 'Leaf',
          leaf: 'status',
          operator: 'eq',
          value: 'PUBLISHED',
        },
        orderBy: [{ kind: 'Leaf', leaf: 'createdAt', direction: 'DESC' }],
        first: 25,
        selections: [{ kind: 'Leaf', name: 'id' }],
      },
    ],

    // Given an "ADMIN" user in the context, the Article's filter returns "true" and the default Article's find operation args applies
    [
      'Article',
      myAdminContext,
      {
        where: {
          id_in: [
            '417bbd06-456c-46b6-aecf-062e913bdacd',
            '9ac87226-f19e-48b8-a8a6-f51a1cb90ea4',
          ],
        },
        orderBy: ['updatedAt_ASC'],
        first: 2,
        selections: [{ kind: 'Leaf', name: 'id' }],
      },
      {
        filter: {
          kind: 'Leaf',
          leaf: 'id',
          operator: 'in',
          value: [
            '417bbd06-456c-46b6-aecf-062e913bdacd',
            '9ac87226-f19e-48b8-a8a6-f51a1cb90ea4',
          ],
        },
        orderBy: [{ kind: 'Leaf', leaf: 'updatedAt', direction: 'ASC' }],
        first: 2,
        selections: [{ kind: 'Leaf', name: 'id' }],
      },
    ],

    /**
     * Given a "JOURNALIST" user in the context:
     *  - the Article's filter returns a filter which is appended to the default Article's find operation args filter
     *  - the User's filter returns a filter which is appended to the "createdBy" edge selection
     */
    [
      'Article',
      myJournalistContext,
      {
        first: 5,
        selections: [
          { kind: 'Leaf', name: 'id' },
          {
            kind: 'Edge',
            name: 'createdBy',
            selections: [{ kind: 'Leaf', name: 'username' }],
          },
        ],
      },
      {
        filter: {
          kind: 'Logical',
          operator: 'and',
          value: [
            {
              kind: 'Edge',
              edge: 'createdBy',
              operator: 'eq',
              value: {
                kind: 'Leaf',
                leaf: 'id',
                operator: 'eq',
                value: '5ff01840-8e75-4b18-baa1-90b51e7318cd',
              },
            },
            {
              kind: 'Leaf',
              leaf: 'status',
              operator: 'eq',
              value: 'PUBLISHED',
            },
          ],
        },
        orderBy: [{ kind: 'Leaf', leaf: 'createdAt', direction: 'DESC' }],
        first: 5,
        selections: [
          { kind: 'Leaf', name: 'id' },
          {
            kind: 'Edge',
            name: 'createdBy',
            args: {
              filter: {
                kind: 'Leaf',
                leaf: 'id',
                operator: 'eq',
                value: '5ff01840-8e75-4b18-baa1-90b51e7318cd',
              },
            },
            selections: [{ kind: 'Leaf', name: 'username' }],
          },
        ],
      },
    ],
  ])(
    'calls the connector',
    async (nodeName, context, args, connectorFindArgs) => {
      const node = gp.getNode(nodeName);

      await expect(
        node.getOperation('find').execute(args, context),
      ).resolves.toEqual([]);

      expect(gp.connector.find).toHaveBeenCalledWith(
        node,
        connectorFindArgs,
        expect.any(OperationContext),
      );
    },
  );
});
