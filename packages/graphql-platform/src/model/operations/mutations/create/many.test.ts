import { GraphQLPlatform } from '../../../..';
import { models, myAdminContext } from '../../../../__tests__/config';
import { mockConnector } from '../../../../__tests__/connector-mock';
import { OperationContext } from '../../../operations';

describe('CreateMany mutation', () => {
  it.skip('calls the connector', async () => {
    const connector = mockConnector({
      count: jest.fn(async (model, args) => {
        // Response for the "Category.order" onCreate's parser
        if (
          model.name === 'Category' &&
          args?.filter?.kind === 'Edge' &&
          args?.filter.edge === 'parent' &&
          args?.filter.operator === 'eq' &&
          args?.filter.value.kind === 'Boolean' &&
          args?.filter.value.value === false
        ) {
          return 0;
        }

        console.debug(String(model), args);

        return 0;
      }),
      find: jest.fn(async (model, args) => {
        // Response for the "Category.parent" onCreate's parser
        if (
          model.name === 'Category' &&
          args.filter?.kind === 'Edge' &&
          args.filter.edge === 'parent' &&
          args.filter.operator === 'eq' &&
          args.filter.value.kind === 'Boolean' &&
          args.filter.value.value === false
        ) {
          return [];
        }

        console.debug(String(model), args);

        return [{ slug: 'the-root-category' }];
      }),
      create: jest.fn(async (model, args) => {
        // console.debug(String(model), args);

        return [{ _id: 38 }];
      }),
    });

    const gp = new GraphQLPlatform({ models, connector });

    const Category = gp.getModel('Category');

    await expect(
      Category.api.create(
        {
          data: { title: 'The root category' },
          selection: `{
            slug
            children(orderBy: [order_ASC], first: 5) {
              slug
            }
          }`,
        },
        myAdminContext,
      ),
    ).resolves.toEqual({
      slug: 'the-root-category',
      children: [],
    });

    expect(connector.create).toHaveBeenCalledWith(
      Category,
      {
        data: [
          {
            title: 'The root category',
            slug: 'the-root-category',
          },
        ],
        selection: {
          node: 'Category',
          fields: [
            { kind: 'Leaf', name: 'title' },
            {
              kind: 'ReverseEdge',
              name: 'children',
              head: {
                node: 'Category',
                fields: [{ kind: 'Leaf', name: 'title' }],
              },
            },
          ],
        },
      },
      expect.any(OperationContext),
    );
  });

  it('supports an operation without "data" argument: createHit', async () => {
    const connector = mockConnector({
      create: jest.fn(async (model, { record }) => ({ _id: 3, ...record })),
      find: jest.fn(async (model) => [{ _id: 3 }]),
    });

    const gp = new GraphQLPlatform({ models, connector });

    const Hit = gp.getModel('Hit');
    expect(Hit.creationInputType.type).toBeUndefined();

    await expect(
      Hit.api.create({ selection: '{ _id }' }, myAdminContext),
    ).resolves.toEqual({
      _id: 3,
    });

    expect(connector.create).toHaveBeenCalledWith(
      Hit,
      {
        record: {
          id: expect.any(String),
          at: expect.any(Date),
        },
      },
      expect.any(OperationContext),
    );

    expect(connector.find).toHaveBeenCalledWith(
      Hit,
      {
        filter: {
          kind: 'Leaf',
          leaf: '_id',
          operator: 'eq',
          value: 3,
        },
        skip: 0,
        first: 1,
        selection: {
          node: 'Hit',
          fields: [{ kind: 'Leaf', name: '_id' }],
        },
      },
      expect.any(OperationContext),
    );
  });
});
