import { Scenario } from '../scenario';

export const scenario: Scenario = [
  // Fixtures tests
  [
    {
      source: `{ 
        articleCount
        articles (orderBy: [slug_ASC], first: 5) {
          id
          slug
          tags (orderBy: [order_ASC], first: 2) {
            tag {
              slug
            }
          }
        }
      }`,
    },
    {
      articleCount: 10,
      articles: [
        {
          id: 'cb0456d1-d580-4d9f-bdad-510abbc96cb0',
          slug: 'assumenda-ut',
          tags: [
            { tag: { slug: 'index-xss-baby-0' } },
            { tag: { slug: 'calculate-bridge-upward-trending-1' } },
          ],
        },
        {
          id: '823c9900-060a-46e9-8dfc-64f192d396a5',
          slug: 'cumque-officia',
          tags: [],
        },
        {
          id: '09b275f1-384b-4176-91da-0c6b7cb5ed46',
          slug: 'dolorem-expedita',
          tags: [{ tag: { slug: 'calculate-bridge-upward-trending-1' } }],
        },
        {
          id: 'd7894f73-4334-4ace-b30e-873bc4470391',
          slug: 'dolorem-vel',
          tags: [{ tag: { slug: 'index-xss-baby-0' } }],
        },
        {
          id: 'e7431737-75b0-4383-ad06-299351e8c732',
          slug: 'dolorum-soluta',
          tags: [
            { tag: { slug: 'calculate-bridge-upward-trending-1' } },
            { tag: { slug: 'refined-soft-bike-initiative-orchid-4' } },
          ],
        },
      ],
    },
  ],
  [
    {
      source: `{ 
        articles (
          where: {
            AND: [
              { tags_some: { tag: { slug: "index-xss-baby-0" } } },
              { tags_some: { tag: { slug: "calculate-bridge-upward-trending-1" } } }
            ]
          }, 
          orderBy: [slug_ASC], 
          first: 5
        ) {
          id
          slug
          tags (orderBy: [order_ASC], first: 2) {
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
          id: 'cb0456d1-d580-4d9f-bdad-510abbc96cb0',
          slug: 'assumenda-ut',
          tags: [
            { tag: { slug: 'index-xss-baby-0' } },
            { tag: { slug: 'calculate-bridge-upward-trending-1' } },
          ],
        },
      ],
    },
  ],
  [
    {
      source: `{ 
        categoryCount 
        categories (first: 5, orderBy: [slug_ASC]) {
          id
          slug
          parent {
            id
          }
        }
      }`,
    },
    {
      categoryCount: 5,
      categories: [
        {
          id: '6fbe024f-2316-4265-a6e8-d65a837e308a',
          parent: {
            id: 'e9756043-0a27-4c82-a99e-f1d792f4ec9a',
          },
          slug: 'blanditiis-natus',
        },
        {
          id: '62f3ccbf-c51b-48ed-ad1d-0420ea196af6',
          parent: {
            id: '6fbe024f-2316-4265-a6e8-d65a837e308a',
          },
          slug: 'eligendi',
        },
        {
          id: 'e3e44790-9992-4f94-b318-6fb7680c80a2',
          parent: {
            id: '62f3ccbf-c51b-48ed-ad1d-0420ea196af6',
          },
          slug: 'rerum-doloremque-officia',
        },
        {
          id: 'e9756043-0a27-4c82-a99e-f1d792f4ec9a',
          parent: null,
          slug: 'root-category',
        },
        {
          id: '452acd60-0c9f-4ab4-87c3-1177e14e4128',
          parent: {
            id: 'e9756043-0a27-4c82-a99e-f1d792f4ec9a',
          },
          slug: 'soluta',
        },
      ],
    },
  ],
  [
    {
      source: `{ 
        tagCount 
        tags (first: 5, orderBy: [slug_ASC]) {
          id
          slug
        }
      }`,
    },
    {
      tagCount: 5,
      tags: [
        {
          id: '7911cf17-59f6-463c-ac94-0c925980eb57',
          slug: 'calculate-bridge-upward-trending-1',
        },
        {
          id: 'ee8272ec-6682-4ae5-99ca-b2eb9ac55c45',
          slug: 'index-xss-baby-0',
        },
        {
          id: '4838fd41-3419-49f6-850d-c43bc966dcb6',
          slug: 'platforms-proactive-3',
        },
        {
          id: 'db8f1272-be3b-4713-88c3-e0b812060108',
          slug: 'refined-2',
        },
        {
          id: '21e0e1c3-9b08-4a02-94f5-943142b23f95',
          slug: 'refined-soft-bike-initiative-orchid-4',
        },
      ],
    },
  ],
  [
    {
      source: `{ 
        userCount 
        users (first: 5, orderBy: [username_ASC]) {
          id
          username
        }
      }`,
    },
    {
      userCount: 5,
      users: [
        {
          id: 'fde2c0a1-07d9-4c97-98f1-926883bea742',
          username: 'annabell',
        },
        {
          id: '2ea063b9-cf6f-4e83-a0ae-64729087ece5',
          username: 'godfrey',
        },
        {
          id: 'ee3d0ef7-685c-4942-bf95-0f9363cd53ed',
          username: 'kobe',
        },
        {
          id: '9f025212-b800-47ff-9507-21582ec854f5',
          username: 'kristina',
        },
        {
          id: 'c53a131c-2154-41c2-bea9-8de9451bb8cb',
          username: 'sydney',
        },
      ],
    },
  ],

  // fetch 1 article with all the field kinds: "__typename" meta field, string, enum, bool, datetime, non-null & null relation ...
  [
    {
      source: `{ 
        articles(first: 1, orderBy: [slug_ASC], where: { category: { parent_is_null: false }, publishedAt_not: null, moderator: null }) {
          __typename
          id
          format
          slug
          publishedAt
          isPublished
          category {
            __typename
            id
          }
          moderator {
            __typename
            id
          }
        }
      }`,
    },
    {
      articles: [
        {
          __typename: 'Article',
          category: {
            __typename: 'Category',
            id: '452acd60-0c9f-4ab4-87c3-1177e14e4128',
          },
          format: 'Video',
          id: '79c0f74f-25e8-486f-ba3f-f8a8c275e082',
          isPublished: true,
          moderator: null,
          publishedAt: '2018-07-09T18:38:55.025Z',
          slug: 'maxime-sint',
        },
      ],
    },
  ],

  // find 1 article in the root category
  [
    {
      source: `{ 
        articles(first: 1, orderBy: [slug_ASC], where: { category: { parent_is_null: true } }) {
          id
          slug
          category {
            id
            slug
            parent {
              id
            }
          }
        }
      }`,
    },
    {
      articles: [
        {
          category: {
            id: 'e9756043-0a27-4c82-a99e-f1d792f4ec9a',
            parent: null,
            slug: 'root-category',
          },
          id: '823c9900-060a-46e9-8dfc-64f192d396a5',
          slug: 'cumque-officia',
        },
      ],
    },
  ],

  // fetch 4 articles not in the root category
  [
    {
      source: `{ 
        articles(first: 4, orderBy: [slug_ASC], where: { category: { parent_is_null: false } }) {
          id
          slug
          category {
            id
            slug
            parent {
              id
            }
          }
        }
      }`,
    },
    {
      articles: [
        {
          category: {
            id: '6fbe024f-2316-4265-a6e8-d65a837e308a',
            parent: {
              id: 'e9756043-0a27-4c82-a99e-f1d792f4ec9a',
            },
            slug: 'blanditiis-natus',
          },
          id: 'cb0456d1-d580-4d9f-bdad-510abbc96cb0',
          slug: 'assumenda-ut',
        },
        {
          category: {
            id: '452acd60-0c9f-4ab4-87c3-1177e14e4128',
            parent: {
              id: 'e9756043-0a27-4c82-a99e-f1d792f4ec9a',
            },
            slug: 'soluta',
          },
          id: '09b275f1-384b-4176-91da-0c6b7cb5ed46',
          slug: 'dolorem-expedita',
        },
        {
          category: {
            id: 'e3e44790-9992-4f94-b318-6fb7680c80a2',
            parent: {
              id: '62f3ccbf-c51b-48ed-ad1d-0420ea196af6',
            },
            slug: 'rerum-doloremque-officia',
          },
          id: 'd7894f73-4334-4ace-b30e-873bc4470391',
          slug: 'dolorem-vel',
        },
        {
          category: {
            id: '6fbe024f-2316-4265-a6e8-d65a837e308a',
            parent: {
              id: 'e9756043-0a27-4c82-a99e-f1d792f4ec9a',
            },
            slug: 'blanditiis-natus',
          },
          id: 'e7431737-75b0-4383-ad06-299351e8c732',
          slug: 'dolorum-soluta',
        },
      ],
    },
  ],

  // fetch 5 articles throught 5 different uniques
  [
    {
      source: `{
        article_01: article(where: { category: { parent: null, slug: "root-category" }, slug: "cumque-officia" }) { id }
        article_02: article(where: { _id: 2 }) { id }
        article_03: article(where: { id: "cb0456d1-d580-4d9f-bdad-510abbc96cb0" }) { id }
        article_04: article(where: { category: { id: "452acd60-0c9f-4ab4-87c3-1177e14e4128" }, slug: "dolorem-expedita" }) { id }
        article_05: article(where: { category: { parent: { id: "62f3ccbf-c51b-48ed-ad1d-0420ea196af6" }, slug: "rerum-doloremque-officia" }, slug: "dolorem-vel" }) { id }
      }`,
    },
    {
      article_01: { id: '823c9900-060a-46e9-8dfc-64f192d396a5' },
      article_02: { id: '91b087c0-917c-45a1-86b1-3f024cdd1ba9' },
      article_03: { id: 'cb0456d1-d580-4d9f-bdad-510abbc96cb0' },
      article_04: { id: '09b275f1-384b-4176-91da-0c6b7cb5ed46' },
      article_05: { id: 'd7894f73-4334-4ace-b30e-873bc4470391' },
    },
  ],

  // execute a query with empty parameter (category/tag)
  [
    {
      source: `query ($where: ArticleWhereInput!) {
        articles(where: $where, first: 1) { id }
      }`,
      variableValues: {
        where: {
          category: {},
          tags_some: {
            tag: {},
          },
        },
      },
    },
    {
      articles: [
        {
          id: '823c9900-060a-46e9-8dfc-64f192d396a5',
        },
      ],
    },
  ],

  // execute a query with some empty or null operator
  [
    {
      source: `query ($where: ArticleWhereInput!) {
        articles(where: $where, first: 1) { id }
      }`,
      variableValues: {
        where: {
          id: '823c9900-060a-46e9-8dfc-64f192d396a5',
          OR: [
            {
              // should be removed
              format_in: null,
            },
            {
              // should return nothing
              format_in: [],
            },
            {
              // should be removed
              format_not_in: null,
            },
            {
              // should return everything
              format_not_in: [],
            },
          ],
        },
      },
    },
    {
      articles: [{ id: '823c9900-060a-46e9-8dfc-64f192d396a5' }],
    },
  ],
  [
    {
      source: `query ($where: ArticleWhereInput!) {
        articles(where: $where, first: 1) { id }
      }`,
      variableValues: {
        where: {
          id_in: [],
        },
      },
    },
    { articles: [] },
  ],
];
