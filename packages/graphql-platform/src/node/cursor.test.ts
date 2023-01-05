import { GraphQLPlatform } from '../index.js';
import { myAdminContext, nodes } from '../__tests__/config.js';
import { mockConnector } from '../__tests__/connector-mock.js';

describe('Cursor', () => {
  it('"Article" is scrollable', async () => {
    let callIndex: number = 0;

    const gp = new GraphQLPlatform({
      nodes,
      connector: mockConnector({
        async find(): Promise<any> {
          const values =
            callIndex === 0
              ? [
                  { _id: 1, id: 'ca001c1c-2e90-461f-96c8-658afa089728' },
                  { _id: 5, id: 'c4f05098-9484-4a2f-b82a-60c3a5d54ec6' },
                ]
              : callIndex === 1
              ? [{ _id: 6, id: '3d0dc22d-0175-462c-afda-70be8702e1b7' }]
              : [];

          callIndex++;

          return values;
        },
      }),
    });

    const Article = gp.getNodeByName('Article');

    const values: any[] = [];

    for await (const value of Article.scroll<{ id: string }>(myAdminContext, {
      selection: '{ id }',
      chunkSize: 2,
    })) {
      values.push(value);
    }

    expect(values).toEqual([
      { id: 'ca001c1c-2e90-461f-96c8-658afa089728' },
      { id: 'c4f05098-9484-4a2f-b82a-60c3a5d54ec6' },
      { id: '3d0dc22d-0175-462c-afda-70be8702e1b7' },
    ]);

    expect(gp.connector.find).toHaveBeenCalledTimes(2);
  });

  it('"ArticleTag" is not scrollable', async () => {
    const gp = new GraphQLPlatform({ nodes });

    expect(() =>
      gp.getNodeByName('ArticleTag').scroll(myAdminContext),
    ).toThrowError('The "ArticleTag" node is not scrollable');
  });
});
