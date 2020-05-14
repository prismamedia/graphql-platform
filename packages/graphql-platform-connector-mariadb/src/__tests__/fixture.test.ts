import { Connector, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Fixture', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;

  beforeAll(async (done) => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();

    await database.reset();

    done();
  });

  afterAll(async (done) => {
    await database.drop();

    done();
  });

  it('loads the fixtures', async (done) => {
    // Load the fixtures without errors
    await expect(gp.loadFixtures()).resolves.toBeUndefined();

    // Query the data
    const { articles } = await gp.execute<{ articles: any[] }>({
      source: `query {
        articles(first: 5, orderBy: [slug_ASC]) {
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
          "id": "cb0456d1-d580-4d9f-bdad-510abbc96cb0",
          "isImportant": false,
          "isPublished": true,
          "publishedAt": "2018-04-30T14:20:57.004Z",
          "slug": "assumenda-ut",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 2,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "http://carolyne.biz",
                      },
                    },
                  },
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://connor.biz",
                      },
                    },
                  },
                ],
                "id": "ee8272ec-6682-4ae5-99ca-b2eb9ac55c45",
                "slug": "index-xss-baby-0",
              },
            },
            Object {
              "comment": Object {
                "body": "Est.",
              },
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 2,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "http://andres.org",
                      },
                    },
                  },
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://connor.biz",
                      },
                    },
                  },
                ],
                "id": "7911cf17-59f6-463c-ac94-0c925980eb57",
                "slug": "calculate-bridge-upward-trending-1",
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
                        "path": "https://connor.biz",
                      },
                    },
                  },
                ],
                "id": "4838fd41-3419-49f6-850d-c43bc966dcb6",
                "slug": "platforms-proactive-3",
              },
            },
          ],
          "url": Object {
            "meta": Object {
              "url": Object {
                "path": "https://connor.biz",
              },
            },
          },
        },
        Object {
          "id": "823c9900-060a-46e9-8dfc-64f192d396a5",
          "isImportant": true,
          "isPublished": true,
          "publishedAt": "2018-04-21T05:01:06.295Z",
          "slug": "cumque-officia",
          "tags": Array [],
          "url": null,
        },
        Object {
          "id": "09b275f1-384b-4176-91da-0c6b7cb5ed46",
          "isImportant": true,
          "isPublished": false,
          "publishedAt": null,
          "slug": "dolorem-expedita",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 2,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "http://andres.org",
                      },
                    },
                  },
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://connor.biz",
                      },
                    },
                  },
                ],
                "id": "7911cf17-59f6-463c-ac94-0c925980eb57",
                "slug": "calculate-bridge-upward-trending-1",
              },
            },
          ],
          "url": Object {
            "meta": null,
          },
        },
        Object {
          "id": "d7894f73-4334-4ace-b30e-873bc4470391",
          "isImportant": true,
          "isPublished": false,
          "publishedAt": null,
          "slug": "dolorem-vel",
          "tags": Array [
            Object {
              "comment": Object {
                "body": "Illum.",
              },
              "tag": Object {
                "allArticleCount": 3,
                "articleWithUrlCount": 2,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "http://carolyne.biz",
                      },
                    },
                  },
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://connor.biz",
                      },
                    },
                  },
                ],
                "id": "ee8272ec-6682-4ae5-99ca-b2eb9ac55c45",
                "slug": "index-xss-baby-0",
              },
            },
          ],
          "url": Object {
            "meta": null,
          },
        },
        Object {
          "id": "e7431737-75b0-4383-ad06-299351e8c732",
          "isImportant": true,
          "isPublished": true,
          "publishedAt": "2018-11-09T04:29:55.177Z",
          "slug": "dolorum-soluta",
          "tags": Array [
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 2,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "http://andres.org",
                      },
                    },
                  },
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://connor.biz",
                      },
                    },
                  },
                ],
                "id": "7911cf17-59f6-463c-ac94-0c925980eb57",
                "slug": "calculate-bridge-upward-trending-1",
              },
            },
            Object {
              "comment": null,
              "tag": Object {
                "allArticleCount": 4,
                "articleWithUrlCount": 3,
                "articles": Array [
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://kiley.org",
                      },
                    },
                  },
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://jesse.biz",
                      },
                    },
                  },
                  Object {
                    "article": Object {
                      "url": Object {
                        "path": "https://rogelio.org",
                      },
                    },
                  },
                ],
                "id": "21e0e1c3-9b08-4a02-94f5-943142b23f95",
                "slug": "refined-soft-bike-initiative-orchid-4",
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
