import { Scenario } from '../scenario';

export const scenario: Scenario = [
  // Fixtures tests
  [
    {
      source: `{ 
        articleCount
        articles (first: 10, orderBy: [_id_ASC]) {
          id
          slug
        }
      }`,
    },
    {
      articleCount: 10,
      articles: [
        {
          id: '87ece569-f025-4212-b800-7ffd50721582',
          slug: 'deserunt-quam',
        },
        {
          id: '192d396a-54b9-4bc1-90cc-bed054a77563',
          slug: 'consequuntur-aut',
        },
        {
          id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
          slug: 'velit-sit',
        },
        {
          id: 'c96cb09c-fb44-4543-aa5c-c879c0f74f25',
          slug: 'architecto-ducimus',
        },
        {
          id: '0391d268-bc8e-483f-bc40-9b275f1384b1',
          slug: 'soluta-sint',
        },
        {
          id: '7651da0c-6b7c-4b5e-946d-daa02b190a19',
          slug: 'officia-quaerat',
        },
        {
          id: '79150fcf-66bd-47f7-97a7-1cf6cef0ac02',
          slug: 'eos-saepe',
        },
        {
          id: 'b9b09810-4fce-4ec8-ab21-293d9be8fdbb',
          slug: 'delectus-aut',
        },
        {
          id: 'b4ef693a-271e-4dd2-94ad-944ff4c885ce',
          slug: 'occaecati-debitis',
        },
        {
          id: '5522d916-fd22-47b2-be97-560430a27c82',
          slug: 'sed-quae',
        },
      ],
    },
  ],
  [
    {
      source: `{ 
        categoryCount 
        categories (first: 5, orderBy: [_id_ASC]) {
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
          id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
          parent: null,
          slug: 'root-category',
        },
        {
          id: '1c39b08a-0214-4f59-8314-2b23f95f0db3',
          parent: {
            id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
          },
          slug: 'sunt',
        },
        {
          id: '4739fde2-c0a1-407d-9c97-58f1926883be',
          parent: {
            id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
          },
          slug: 'quisquam-recusandae-alias',
        },
        {
          id: '7b73d789-4f73-4433-8ace-730e873bc447',
          parent: {
            id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
          },
          slug: 'repellat',
        },
        {
          id: '450e934d-8de8-4623-b50e-ee9d6ea32163',
          parent: {
            id: '4739fde2-c0a1-407d-9c97-58f1926883be',
          },
          slug: 'iure',
        },
      ],
    },
  ],
  [
    {
      source: `{ 
        tagCount 
        tags (first: 5, orderBy: [_id_ASC]) {
          id
          slug
        }
      }`,
    },
    {
      tagCount: 5,
      tags: [
        {
          id: 'cdd1ba92-287e-4573-99d4-2e8e74317377',
          slug: 'neural-4',
        },
        {
          id: '5b0383ad-0629-4935-9e8c-73239a82a82f',
          slug: 'michigan-frozen-3',
        },
        {
          id: 'c2308ecb-0456-4d1d-980d-9f3dad510abb',
          slug: 'ameliorated-oman-district-2',
        },
        {
          id: 'e886ffa3-ff8a-48c2-b5e0-829be055bdcb',
          slug: 'yen-operations-0',
        },
        {
          id: '15e6083f-d04b-47ea-8284-5ede88b47ea7',
          slug: 'e-tailers-kyat-violet-1',
        },
      ],
    },
  ],
  [
    {
      source: `{ 
        userCount 
        users (first: 5, orderBy: [_id_ASC]) {
          id
          username
        }
      }`,
    },
    {
      userCount: 5,
      users: [
        {
          id: 'a7421c53-a131-4c21-941c-23ea98de9451',
          username: 'Michel',
        },
        {
          id: 'bb8cbe2e-a063-4b9c-b6fe-83e0ae647290',
          username: 'Elza',
        },
        {
          id: 'ec854f59-ee3d-40ef-b685-c9427f950f93',
          username: 'Augusta',
        },
        {
          id: '63cd53ed-9823-4c99-8006-0a6e90dfc64f',
          username: 'Priscilla',
        },
        {
          id: '60685298-62f6-4aa3-8605-3c0eeeca8404',
          username: 'Vivianne',
        },
      ],
    },
  ],

  // fetch 1 article with all the field kinds: "__typename" meta field, string, enum, bool, datetime, non-null & null relation ...
  [
    {
      source: `{ 
        articles(first: 1, orderBy: [_id_ASC], where: { category: { parent_is_null: false }, publishedAt_not: null, moderator: null }) {
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
          id: '7651da0c-6b7c-4b5e-946d-daa02b190a19',
          format: 'Video',
          slug: 'officia-quaerat',
          publishedAt: '2018-07-05T00:47:52.153Z',
          isPublished: true,
          category: {
            __typename: 'Category',
            id: '7b73d789-4f73-4433-8ace-730e873bc447',
          },
          moderator: null,
        },
      ],
    },
  ],

  // find 1 article in the root category
  [
    {
      source: `{ 
        articles(first: 1, orderBy: [_id_ASC], where: { category: { parent_is_null: true } }) {
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
          id: 'c96cb09c-fb44-4543-aa5c-c879c0f74f25',
          slug: 'architecto-ducimus',
          category: {
            id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
            slug: 'root-category',
            parent: null,
          },
        },
      ],
    },
  ],

  // fetch 4 articles not in the root category
  [
    {
      source: `{ 
        articles(first: 4, orderBy: [_id_ASC], where: { category: { parent_is_null: false } }) {
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
          id: '87ece569-f025-4212-b800-7ffd50721582',
          slug: 'deserunt-quam',
          category: {
            id: '4739fde2-c0a1-407d-9c97-58f1926883be',
            slug: 'quisquam-recusandae-alias',
            parent: {
              id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
            },
          },
        },
        {
          id: '192d396a-54b9-4bc1-90cc-bed054a77563',
          slug: 'consequuntur-aut',
          category: {
            id: '4739fde2-c0a1-407d-9c97-58f1926883be',
            slug: 'quisquam-recusandae-alias',
            parent: {
              id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
            },
          },
        },
        {
          id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024',
          slug: 'velit-sit',
          category: {
            id: '4739fde2-c0a1-407d-9c97-58f1926883be',
            slug: 'quisquam-recusandae-alias',
            parent: {
              id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
            },
          },
        },
        {
          id: '0391d268-bc8e-483f-bc40-9b275f1384b1',
          slug: 'soluta-sint',
          category: {
            id: '7b73d789-4f73-4433-8ace-730e873bc447',
            slug: 'repellat',
            parent: {
              id: '199f6850-dc43-4bc9-a6dc-b68625021e0e',
            },
          },
        },
      ],
    },
  ],

  // fetch 5 articles throught 5 different uniques
  [
    {
      source: `{
        article_01: article(where: { category: { parent: null, slug: "root-category" }, slug: "architecto-ducimus" }) { id }
        article_02: article(where: { _id: 1 }) { id }
        article_03: article(where: { id: "192d396a-54b9-4bc1-90cc-bed054a77563" }) { id }
        article_04: article(where: { category: { id: "4739fde2-c0a1-407d-9c97-58f1926883be" }, slug: "velit-sit" }) { id }
        article_05: article(where: { category: { parent: { id: "199f6850-dc43-4bc9-a6dc-b68625021e0e" }, slug: "repellat" }, slug: "soluta-sint" }) { id }
      }`,
    },
    {
      article_01: { id: 'c96cb09c-fb44-4543-aa5c-c879c0f74f25' },
      article_02: { id: '87ece569-f025-4212-b800-7ffd50721582' },
      article_03: { id: '192d396a-54b9-4bc1-90cc-bed054a77563' },
      article_04: { id: '4d88dc29-1b08-47c0-917c-5a1c6b13f024' },
      article_05: { id: '0391d268-bc8e-483f-bc40-9b275f1384b1' },
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
          id: '87ece569-f025-4212-b800-7ffd50721582',
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
          id: '87ece569-f025-4212-b800-7ffd50721582',
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
      articles: [{ id: '87ece569-f025-4212-b800-7ffd50721582' }],
    },
  ],
];
