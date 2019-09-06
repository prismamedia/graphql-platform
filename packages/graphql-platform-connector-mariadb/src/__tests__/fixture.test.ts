import { BoundOff } from '@prismamedia/ts-async-event-emitter';
import { Connection, format } from 'mysql';
import { format as beautify } from 'sql-formatter';
import { Connector, ConnectorEventKind, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Fixture', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;

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
      [ConnectorEventKind.PreStartTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('START TRANSACTION;');
      },
      [ConnectorEventKind.PreCommitTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('COMMIT;');
      },
      [ConnectorEventKind.PreRollbackTransaction]: ({ threadId }) => {
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
    await expect(gp.loadFixtures()).resolves.toBeUndefined();

    expect(
      [`# ${queries.length} queries in ${connectionSet.size} connections`, ...queries].join('\n\n'),
    ).toMatchSnapshot();

    // Query the data
    const { articles } = await gp.execute<{ articles: any[] }>({
      source: `query {
        articles(first: 10, orderBy: [_id_ASC]) {
          id
          publishedAt
          isPublished
          isImportant
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

    // Then check the data
    expect(articles).toMatchInlineSnapshot(`
      Array [
        Object {
          "id": "87ece569-f025-4212-b800-7ffd50721582",
          "isImportant": true,
          "isPublished": false,
          "publishedAt": null,
          "slug": "deserunt-quam",
          "tags": Array [],
          "url": null,
        },
        Object {
          "id": "192d396a-54b9-4bc1-90cc-bed054a77563",
          "isImportant": false,
          "isPublished": true,
          "publishedAt": "2018-09-24T11:25:53.212Z",
          "slug": "consequuntur-aut",
          "tags": Array [],
          "url": null,
        },
        Object {
          "id": "4d88dc29-1b08-47c0-917c-5a1c6b13f024",
          "isImportant": true,
          "isPublished": false,
          "publishedAt": null,
          "slug": "velit-sit",
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
                        "path": "https://nick.biz",
                      },
                    },
                  },
                ],
                "id": "cdd1ba92-287e-4573-99d4-2e8e74317377",
                "slug": "neural-4",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 0,
                "articles": Array [],
                "id": "5b0383ad-0629-4935-9e8c-73239a82a82f",
                "slug": "michigan-frozen-3",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://claudie.net",
                      },
                    },
                  },
                ],
                "id": "c2308ecb-0456-4d1d-980d-9f3dad510abb",
                "slug": "ameliorated-oman-district-2",
              },
            },
          ],
          "url": null,
        },
        Object {
          "id": "c96cb09c-fb44-4543-aa5c-c879c0f74f25",
          "isImportant": false,
          "isPublished": false,
          "publishedAt": null,
          "slug": "architecto-ducimus",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://claudie.net",
                      },
                    },
                  },
                ],
                "id": "e886ffa3-ff8a-48c2-b5e0-829be055bdcb",
                "slug": "yen-operations-0",
              },
            },
          ],
          "url": null,
        },
        Object {
          "id": "0391d268-bc8e-483f-bc40-9b275f1384b1",
          "isImportant": true,
          "isPublished": false,
          "publishedAt": null,
          "slug": "soluta-sint",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 0,
                "articles": Array [],
                "id": "5b0383ad-0629-4935-9e8c-73239a82a82f",
                "slug": "michigan-frozen-3",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://claudie.net",
                      },
                    },
                  },
                ],
                "id": "e886ffa3-ff8a-48c2-b5e0-829be055bdcb",
                "slug": "yen-operations-0",
              },
            },
            Object {
              "comment": Object {
                "body": "Dolore.",
              },
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://kathryne.org",
                      },
                    },
                  },
                ],
                "id": "15e6083f-d04b-47ea-8284-5ede88b47ea7",
                "slug": "e-tailers-kyat-violet-1",
              },
            },
          ],
          "url": null,
        },
        Object {
          "id": "7651da0c-6b7c-4b5e-946d-daa02b190a19",
          "isImportant": true,
          "isPublished": true,
          "publishedAt": "2018-07-05T00:47:52.153Z",
          "slug": "officia-quaerat",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://claudie.net",
                      },
                    },
                  },
                ],
                "id": "c2308ecb-0456-4d1d-980d-9f3dad510abb",
                "slug": "ameliorated-oman-district-2",
              },
            },
            Object {
              "comment": Object {
                "body": "Quis.",
              },
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://claudie.net",
                      },
                    },
                  },
                ],
                "id": "e886ffa3-ff8a-48c2-b5e0-829be055bdcb",
                "slug": "yen-operations-0",
              },
            },
          ],
          "url": Object {
            "meta": null,
          },
        },
        Object {
          "id": "79150fcf-66bd-47f7-97a7-1cf6cef0ac02",
          "isImportant": true,
          "isPublished": true,
          "publishedAt": "2018-08-22T03:21:11.726Z",
          "slug": "eos-saepe",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 0,
                "articles": Array [],
                "id": "5b0383ad-0629-4935-9e8c-73239a82a82f",
                "slug": "michigan-frozen-3",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://claudie.net",
                      },
                    },
                  },
                ],
                "id": "c2308ecb-0456-4d1d-980d-9f3dad510abb",
                "slug": "ameliorated-oman-district-2",
              },
            },
          ],
          "url": null,
        },
        Object {
          "id": "b9b09810-4fce-4ec8-ab21-293d9be8fdbb",
          "isImportant": true,
          "isPublished": true,
          "publishedAt": "2018-12-08T14:46:11.842Z",
          "slug": "delectus-aut",
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
                        "path": "https://nick.biz",
                      },
                    },
                  },
                ],
                "id": "cdd1ba92-287e-4573-99d4-2e8e74317377",
                "slug": "neural-4",
              },
            },
          ],
          "url": Object {
            "meta": Object {
              "url": Object {
                "path": "https://nick.biz",
              },
            },
          },
        },
        Object {
          "id": "b4ef693a-271e-4dd2-94ad-944ff4c885ce",
          "isImportant": false,
          "isPublished": false,
          "publishedAt": null,
          "slug": "occaecati-debitis",
          "tags": Array [
            Object {
              "comment": Object {
                "body": "Quia.",
              },
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://kathryne.org",
                      },
                    },
                  },
                ],
                "id": "15e6083f-d04b-47ea-8284-5ede88b47ea7",
                "slug": "e-tailers-kyat-violet-1",
              },
            },
          ],
          "url": Object {
            "meta": Object {
              "url": Object {
                "path": "https://kathryne.org",
              },
            },
          },
        },
        Object {
          "id": "5522d916-fd22-47b2-be97-560430a27c82",
          "isImportant": false,
          "isPublished": true,
          "publishedAt": "2018-02-12T15:49:15.009Z",
          "slug": "sed-quae",
          "tags": Array [
            Object {
              "comment": Object {
                "body": "Incidunt.",
              },
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 0,
                "articles": Array [],
                "id": "5b0383ad-0629-4935-9e8c-73239a82a82f",
                "slug": "michigan-frozen-3",
              },
            },
            Object {
              "comment": Object {
                "body": "Delectus.",
              },
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://kathryne.org",
                      },
                    },
                  },
                ],
                "id": "15e6083f-d04b-47ea-8284-5ede88b47ea7",
                "slug": "e-tailers-kyat-violet-1",
              },
            },
            Object {
              "comment": Object {
                "body": "Minima.",
              },
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 1,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://claudie.net",
                      },
                    },
                  },
                ],
                "id": "c2308ecb-0456-4d1d-980d-9f3dad510abb",
                "slug": "ameliorated-oman-district-2",
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
