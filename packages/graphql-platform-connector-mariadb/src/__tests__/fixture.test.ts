import { BoundOff } from '@prismamedia/ts-async-event-emitter';
import { printError } from 'graphql';
import { Connection, format } from 'mysql';
import { format as beautify } from 'sql-formatter';
import { Connector, ConnectorEventKind, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Fixture', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;
  const fixturePath = `${__dirname}/../../../graphql-platform-core/src/__tests__/fixtures`;

  let connectionSet = new Set<Connection['threadId']>();
  let queries: string[] = [];
  let offListeners: BoundOff[];

  beforeAll(async done => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();

    await database.reset();

    done();
  });

  beforeEach(async done => {
    offListeners = connector.onConfig({
      [ConnectorEventKind.StartTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('START TRANSACTION;');
      },
      [ConnectorEventKind.CommitTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('COMMIT;');
      },
      [ConnectorEventKind.RollbackTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('ROLLBACK;');
      },
      [ConnectorEventKind.PreQuery]: ({ threadId, sql, values }) => {
        connectionSet.add(threadId);
        queries.push(beautify(format(sql, values)));
      },
    });

    done();
  });

  afterEach(async done => {
    offListeners && offListeners.map(off => off());
    connectionSet.clear();
    queries.length = 0;

    await database.truncate();

    done();
  });

  afterAll(async () => database.drop());

  it('loads the fixtures', async done => {
    // Load the fixtures without errors
    await expect(gp.loadFixtures(fixturePath)).resolves.toBeUndefined();

    expect(
      [`# ${queries.length} queries in ${connectionSet.size} connections`, ...queries].join('\n\n'),
    ).toMatchSnapshot();

    // Query the data
    const { data, errors } = await gp.execute<{ articles: any[] }>({
      source: `query {
        articles(first: 10, orderBy: [_id_ASC]) {
          id
          slug
          url {
            meta {
              url {
                path
              }
            }
          }
          tags(first: 5, orderBy: [order_ASC]) {
            comment {
              body
            }
            tag {
              id
              slug
              allArticleCount: articleCount
              articleWithUrlCount: articleCount(where: { article: { url_is_null: false } })
              articles(where: { article: { url_is_null: false } }, first: 10, orderBy: [createdAt_DESC]) {
                article {
                  url {
                    path
                  }
                }
              }
            }
          }
        }
      }`,
    });

    if (errors) {
      const error = errors[0];

      console.error(printError(error));
      throw error;
    }

    // Then check the data
    expect(data.articles).toMatchInlineSnapshot(`
      Array [
        Object {
          "id": "9b6b98fa-586d-4987-82a0-d63f11bbe560",
          "slug": "my-first-articles-title-a-rich-article",
          "tags": Array [
            Object {
              "comment": Object {
                "body": "This is why I tagged the Article \\"article_01\\" with the Tag \\"tag_01\\"",
              },
              "tag": Object {
                "allArticleCount": 1,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "/my-article-01",
                      },
                    },
                  },
                ],
                "id": "d0ae7305-ddce-4870-a0f9-0f7ef19b86ea",
                "slug": "my-first-tag",
              },
            },
            Object {
              "comment": Object {
                "body": "And this is why I tagged the Article \\"article_01\\" with the Tag \\"tag_02\\"",
              },
              "tag": Object {
                "allArticleCount": 1,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "/my-article-01",
                      },
                    },
                  },
                ],
                "id": "511ed2c7-0557-4e5d-8bce-d4956cac48eb",
                "slug": "my-second-tag",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 1,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "/my-article-01",
                      },
                    },
                  },
                ],
                "id": "3480abaa-5580-4dbe-8e55-cb0b622e1da5",
                "slug": "my-third-tag",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 2,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "/my-article-01",
                      },
                    },
                  },
                ],
                "id": "1b4cc2fd-0e1f-4b97-bed5-171f52d18b1b",
                "slug": "my-fourth-tag",
              },
            },
          ],
          "url": Object {
            "meta": Object {
              "url": Object {
                "path": "/my-article-01",
              },
            },
          },
        },
        Object {
          "id": "06bd57da-24f6-488a-a1b1-2435bd7c8d6e",
          "slug": "my-second-articles-title-a-video",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 2,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "/my-article-01",
                      },
                    },
                  },
                ],
                "id": "1b4cc2fd-0e1f-4b97-bed5-171f52d18b1b",
                "slug": "my-fourth-tag",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 1,
                "articleWithUrlCount": 0,
                "articles": Array [],
                "id": "91eef28c-598a-433c-9e2c-06d6bd6b455c",
                "slug": "my-fifth-tag",
              },
            },
          ],
          "url": null,
        },
      ]
    `);

    done();
  });
});
