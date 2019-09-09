import { Scenario } from '../scenario';

export const scenario: Scenario = [
  // Fetch an article to know its state
  [
    {
      source: `query {
        articles(where: { tags_some: { order_gte: 0 } }, orderBy: [_id_ASC], first: 1) {
          id
          url {
            path
          }
          tags(orderBy: [order_ASC], first: 5) {
            order
            tag {
              slug
            }
          }
        }
      }`,
    },
    {
      articles: [
        {
          id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
          url: null,
          tags: [
            {
              order: 0,
              tag: {
                slug: 'neural-4',
              },
            },
            {
              order: 1,
              tag: {
                slug: 'michigan-frozen-3',
              },
            },
            {
              order: 2,
              tag: {
                slug: 'ameliorated-oman-district-2',
              },
            },
          ],
        },
      ],
    },
  ],

  /**
   * We can create with the nested actions:
   * - a new "ArticleUrl" node
   * - a new "ArticleTag" node
   */
  [
    {
      source: `mutation {
        updateArticle(
          where: { id: "4d88dc29-1b08-47c0-917c-5a1c6b13f024" },
          data: {
            url: {
              create: {
                path: "/success"
              }
            },
            tags: {
              create: [
                {
                  order: 3
                  tag: {
                    connect: {
                      slug: "yen-operations-0"
                    }
                  }
                }
              ]
            }
          }
        ) {
          id
          url {
            path
          }
          tags(orderBy: [order_ASC], first: 5) {
            order
            tag {
              slug
            }
          }
        }
      }`,
    },
    {
      updateArticle: {
        id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
        url: {
          path: '/success',
        },
        tags: [
          {
            order: 0,
            tag: {
              slug: 'neural-4',
            },
          },
          {
            order: 1,
            tag: {
              slug: 'michigan-frozen-3',
            },
          },
          {
            order: 2,
            tag: {
              slug: 'ameliorated-oman-district-2',
            },
          },
          {
            order: 3,
            tag: {
              slug: 'yen-operations-0',
            },
          },
        ],
      },
    },
  ],

  /**
   * We can update an "ArticleUrl" node through the nested actions
   */
  [
    {
      source: `mutation {
        updateArticle(
          where: { id: "4d88dc29-1b08-47c0-917c-5a1c6b13f024" },
          data: {
            url: {
              update: {
                data: {
                  path: "/still-a-success"
                }
              }
            },
          }
        ) {
          id
          url {
            path
          }
        }
      }`,
    },
    {
      updateArticle: {
        id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
        url: {
          path: '/still-a-success',
        },
      },
    },
  ],

  /**
   * We can delete with the nested actions:
   * - an "ArticleUrl" node
   * - several "ArticleTag" nodes
   */
  [
    {
      source: `mutation {
        updateArticle(
          where: { id: "4d88dc29-1b08-47c0-917c-5a1c6b13f024" },
          data: {
            url: {
              delete: true
            },
            tags: {
              create: [
                {
                  order: 2,
                  tag: { connect: { slug: "yen-operations-0" }}
                }
              ],
              delete: [
                {
                  order: 2
                },
                {
                  order: 3
                }
              ]
            }
          }
        ) {
          id
          url {
            path
          }
          tags(orderBy: [order_ASC], first: 5) {
            order
            tag {
              slug
            }
          }
        }
      }`,
    },
    {
      updateArticle: {
        id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
        url: null,
        tags: [
          {
            order: 0,
            tag: {
              slug: 'neural-4',
            },
          },
          {
            order: 1,
            tag: {
              slug: 'michigan-frozen-3',
            },
          },
          {
            order: 2,
            tag: {
              slug: 'yen-operations-0',
            },
          },
        ],
      },
    },
  ],

  // Or with the root mutation ...
  [
    {
      source: `mutation {
        deleteArticleTag(where: { article: { id: "4d88dc29-1b08-47c0-917c-5a1c6b13f024" }, order: 1 }) {
          tag {
            slug
          }
        }
      }`,
    },
    {
      deleteArticleTag: {
        tag: {
          slug: 'michigan-frozen-3',
        },
      },
    },
  ],

  // ... only once.
  [
    {
      source: `mutation {
        deleteArticleTag(where: { article: { id: "4d88dc29-1b08-47c0-917c-5a1c6b13f024" }, order: 1 }) {
          tag {
            slug
          }
        }
      }`,
    },
    {
      deleteArticleTag: null,
    },
  ],

  // Fetch a category to know its state
  [
    {
      source: `query {
        categories(where: { articles_some: { isPublished: true } }, orderBy: [_id_ASC], first: 1) {
          id
          articles (orderBy: [_id_ASC], first: 10) {
            id
            slug
            title
          }
        }
      }`,
    },
    {
      categories: [
        {
          id: '4739fde2-c0a1-407d-9c97-58f1926883be',
          articles: [
            {
              id: '87ece569-f025-4212-b800-7ffd50721582',
              slug: 'deserunt-quam',
              title: 'Deserunt quam.',
            },
            {
              id: '192d396a-54b9-4bc1-90cc-bed054a77563',
              slug: 'consequuntur-aut',
              title: 'Consequuntur aut.',
            },
            {
              id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
              slug: 'velit-sit',
              title: 'Velit sit.',
            },
            {
              id: '79150fcf-66bd-47f7-97a7-1cf6cef0ac02',
              slug: 'eos-saepe',
              title: 'Eos saepe.',
            },
          ],
        },
      ],
    },
  ],

  // We can update with the nested actions
  [
    {
      source: `mutation {
        updateCategory(
          where: { id: "4739fde2-c0a1-407d-9c97-58f1926883be" },
          data: {
            articles: {
              update: [
                # Update an article already connected
                {
                  where: { slug: "eos-saepe" },
                  data: { title: "My new article's title" }
                },

                # Update an article not yet connected
                {
                  where: { id: "c96cb09c-fb44-4543-aa5c-c879c0f74f25" },
                  data: { title: "My new connected article" }
                }
              ],
              upsert: [
                {
                  where: { slug: "velit-sit" },
                  update: { title: "The new title of this existing article" },
                  create: { format: Rich, title: "The title of this new rich article, written by Priscilla", author: { connect: { id: "63cd53ed-9823-4c99-8006-0a6e90dfc64f" } } }
                },
                {
                  where: { slug: "unknown-slug" },
                  update: {},
                  create: { format: Video, title: "The title of this new video, written by Vivianne", author: { connect: { id: "60685298-62f6-4aa3-8605-3c0eeeca8404" } } }
                }
              ]
            }
          }
        ) {
          id
          articles (orderBy: [_id_ASC], first: 10) {
            id
            slug
            title
          }
        }
      }`,
    },
    {
      updateCategory: {
        id: '4739fde2-c0a1-407d-9c97-58f1926883be',
        articles: [
          {
            id: '87ece569-f025-4212-b800-7ffd50721582',
            slug: 'deserunt-quam',
            title: 'Deserunt quam.',
          },
          {
            id: '192d396a-54b9-4bc1-90cc-bed054a77563',
            slug: 'consequuntur-aut',
            title: 'Consequuntur aut.',
          },
          {
            id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
            slug: 'velit-sit',
            title: 'The new title of this existing article',
          },
          {
            id: 'c96cb09c-fb44-4543-aa5c-c879c0f74f25',
            slug: 'architecto-ducimus',
            title: 'My new connected article',
          },
          {
            id: '79150fcf-66bd-47f7-97a7-1cf6cef0ac02',
            slug: 'eos-saepe',
            title: "My new article's title",
          },
          {
            id: '299ef1d7-92f4-4ec9-a0b1-3117e65f92ff',
            slug: 'the-title-of-this-new-video-written-by-vivianne',
            title: 'The title of this new video, written by Vivianne',
          },
        ],
      },
    },
  ],

  /**
   * Upsert a "toOne" inverse relation (create or update the related document)
   */
  [
    {
      source: `mutation {
        first: updateArticle(
          where: { id: "4d88dc29-1b08-47c0-917c-5a1c6b13f024" },
          data: {
            url: {
              upsert: {
                update: {
                  path: "/updated"
                },
                create: {
                  path: "/created"
                }
              }
            }
          }
        ) {
          url {
            path
          }
        }

        second: updateArticle(
          where: { id: "4d88dc29-1b08-47c0-917c-5a1c6b13f024" },
          data: {
            url: {
              upsert: {
                update: {
                  path: "/updated"
                },
                create: {
                  path: "/created"
                }
              }
            }
          }
        ) {
          url {
            path
          }
        }
      }`,
    },
    {
      first: {
        url: {
          path: '/created',
        },
      },
      second: {
        url: {
          path: '/updated',
        },
      },
    },
  ],
];
