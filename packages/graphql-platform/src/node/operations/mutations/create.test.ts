import { GraphQLPlatform, IConnector, TCreateValue } from '../..';
import { INodeValue } from '../../node';
import { myJournalistContext, nodes } from '../../__tests__/config';
import { mockConnector } from '../../__tests__/connector-mock';
import { OperationContext } from '../context';
import { ICreateOperationArgs } from './create';

describe('Create operation', () => {
  it.skip('throws an Error on unknown onCreate field dependency', () => {
    expect(
      () =>
        new GraphQLPlatform({
          nodes: {
            ...nodes,
            Article: {
              ...nodes.Article,
              components: {
                ...nodes.Article.components,
                _id: {
                  ...nodes.Article.components._id,
                  onCreate: {
                    ...nodes.Article.components._id.onCreate,
                    dependencies: ['unknownField'],
                  },
                },
              },
            },
          },
        }),
    ).toThrowError(
      'The field "createArticle._id" cannot depend on the unknown field "unknownField", did you mean:',
    );
  });

  it('throws an Error on invalid onCreate field dependency', () => {
    expect(
      () =>
        new GraphQLPlatform({
          nodes: {
            ...nodes,
            Article: {
              ...nodes.Article,
              components: {
                ...nodes.Article.components,
                _id: {
                  ...nodes.Article.components._id,
                  onCreate: {
                    ...nodes.Article.components._id.onCreate,
                    dependencies: ['id'],
                  },
                },
                id: {
                  ...nodes.Article.components.id,
                  onCreate: {
                    ...nodes.Article.components.id.onCreate,
                    dependencies: ['_id'],
                  },
                },
              },
            },
          },
        }),
    ).toThrowError(
      'The field "createArticle.id" cannot depend on "_id", a circular dependency has been found: _id -> id -> _id',
    );
  });

  it.skip.each([
    [
      'Article',
      undefined,
      'An error has occurred at createArticle.args.data - expects an object containing the required field(s) "title", got: undefined',
    ],
    [
      'Article',
      null,
      'An error has occurred at createArticle.args.data - expects an object containing the required field(s) "title", got: null',
    ],
    [
      'Article',
      { unknownField: null },
      'An error has occurred at createArticle.args.data - expects not to contain the extra field "unknownField", got: {"unknownField":null}',
    ],
    [
      'Article',
      { title: 'A Valid title', unknownField: null },
      'An error has occurred at createArticle.args.data - expects not to contain the extra field "unknownField", got: {"title":"A Valid title","unknownField":null}',
    ],
    [
      'Article',
      {},
      'An error has occurred at createArticle.args.data - expects to contain the required field(s) "title", got: {}',
    ],
  ])('throws an Error on create%s(%p)', async (nodeName, data, error) => {
    const gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({
        onSuccess: jest.fn(async () => {}),
        onFailure: jest.fn(async () => {}),
      }),
    });

    const node = gp.getNode(nodeName);
    const create = node.getOperation('create');

    await expect(async () =>
      create.execute({
        // @ts-expect-error
        data,
        selections: node.identifierSelections,
      }),
    ).rejects.toThrowError(error);

    expect(gp.connector.onSuccess).toHaveBeenCalledTimes(0);
    expect(gp.connector.onFailure).toHaveBeenCalledWith(
      expect.any(OperationContext),
    );
  });

  it.skip.each<
    [
      nodeName: string,
      data: ICreateOperationArgs['data'],
      connector: Partial<IConnector>,
      input: TCreateValue | undefined,
      output: INodeValue,
    ]
  >([
    [
      'Category',
      {
        id: 'a5f55dad-0af6-4f34-86d8-08855d311771',
        title: " My category's title ",
        order: 0,
      },
      {},
      {
        id: 'a5f55dad-0af6-4f34-86d8-08855d311771',
        title: "My category's title",
        slug: 'my-categorys-title',
        order: 0,
      },
      {
        _id: 5,
      },
    ],

    [
      'Category',
      {
        id: '020044b7-f842-4709-8d0a-7951f6d55960',
        title: "My other category's title",
        order: 0,
        parent: { connect: { id: 'a5f55dad-0af6-4f34-86d8-08855d311771' } },
      },
      {
        find: jest.fn(async () => [{ _id: 123 }]),
      },
      {
        id: '020044b7-f842-4709-8d0a-7951f6d55960',
        title: "My other category's title",
        slug: 'my-other-categorys-title',
        order: 0,
        parent: { _id: 123 },
      },
      {
        _id: 5,
      },
    ],

    // Both "undefined" and "{}" work here
    ['Hit', undefined, {}, undefined, { _id: 10 }],
    ['Hit', {}, {}, undefined, { _id: 10 }],
  ])(
    'executes create%s(%p)',
    async (nodeName, data, connector, input, output) => {
      const gp = new GraphQLPlatform({
        nodes,
        connector: mockConnector({
          ...connector,
          create: jest.fn(async () => [output]),
          onSuccess: jest.fn(async () => {}),
          onFailure: jest.fn(async () => {}),
        }),
      });
      const node = gp.getNode(nodeName);
      const create = node.getOperation('create');

      await expect(
        create.execute(
          {
            data,
            selections: node.identifierSelections,
          },
          myJournalistContext,
        ),
      ).resolves.toEqual(output);

      expect(gp.connector.create).toHaveBeenCalledWith(
        node,
        {
          data: [input],
          selections: node.identifierSelections,
        },
        expect.any(OperationContext),
      );

      expect(gp.connector.onSuccess).toHaveBeenCalledWith(
        expect.any(OperationContext),
      );
      expect(gp.connector.onFailure).toHaveBeenCalledTimes(0);
    },
  );
});
