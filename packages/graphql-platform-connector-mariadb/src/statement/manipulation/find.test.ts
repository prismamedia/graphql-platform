import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  ArticleStatus,
  myAdminContext,
  myUserContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { format } from '@sqltools/formatter';
import { createMyGP, type MyGP } from '../../__tests__/config.js';

describe('Find statement', () => {
  let gp: MyGP;
  const executedStatements: string[] = [];

  beforeAll(async () => {
    gp = createMyGP(`connector_mariadb_find_statement`);
    gp.connector.on('executed-statement', ({ statement }) =>
      executedStatements.push(format(statement.sql).replaceAll('<= >', '<=>')),
    );

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  afterAll(() => gp.connector.teardown());

  it.each([
    [
      'Article',
      myUserContext,
      {
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          status
          title
          body
          views
          score
          machineTags
          metas
          tagCount
          createdAt
        }`,
      },
      [
        {
          body: null,
          createdAt: new Date('2022-03-01T00:00:00.000Z'),
          machineTags: null,
          metas: null,
          score: 0.5,
          status: 'published',
          tagCount: 2,
          title: 'My first published article',
          views: 0n,
        },
        {
          body: {
            blocks: [],
            entityMap: {},
          },
          createdAt: new Date('2022-04-01T00:00:00.000Z'),
          machineTags: ['namespace:key=a_value', 'namespace:key=other_value'],
          metas: {
            aKey: 'withAnyValue',
          },
          score: 0.12,
          status: 'published',
          tagCount: 1,
          title: 'My second published article',
          views: 1234567890n,
        },
        {
          body: null,
          createdAt: new Date('2022-05-01T00:00:00.000Z'),
          machineTags: null,
          metas: null,
          score: 0.5,
          status: 'published',
          tagCount: 3,
          title: 'My first published article in root category',
          views: 0n,
        },
        {
          body: null,
          createdAt: new Date('2022-06-01T00:00:00.000Z'),
          machineTags: null,
          metas: null,
          score: 0.5,
          status: 'published',
          tagCount: 2,
          title: 'My second published article in root category',
          views: 0n,
        },
      ],
    ],
    [
      'Article',
      myAdminContext,
      {
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          status
          title
        }`,
      },
      [
        {
          status: 'draft',
          title: 'My first draft article',
        },
        {
          status: 'draft',
          title: 'My second draft article',
        },
        {
          status: 'published',
          title: 'My first published article',
        },
        {
          status: 'published',
          title: 'My second published article',
        },
        {
          status: 'published',
          title: 'My first published article in root category',
        },
      ],
    ],
    [
      'Article',
      myAdminContext,
      {
        where: {
          OR: [
            { body_is_null: true },
            { body_contains: 'my searched text here' },
            { body_starts_with: 'my starting text here' },
            { body_ends_with: 'my ending text here' },
          ],
          status: ArticleStatus.PUBLISHED,
          category: { slug: 'tv' },
          createdAt_gte: '2022-01-01T00:00:00Z',
          createdBy: {
            profile: {
              OR: [
                { facebookId_is_null: false },
                { googleId_is_null: false },
                { twitterHandle_is_null: false },
              ],
            },
          },
          tagCount_gt: 5,
          tags_some: { tag: { deprecated_not: true } },
        },
        orderBy: ['createdAt_ASC'],
        first: 5,
        selection: `{
          status
          title
          category {
            title
          }
          createdBy {
            username
            profile {
              facebookId
              googleId
              twitterHandle
            }
          }
          allTagCount: tagCount
          filteredTagCount: tagCount(where: { tag_not: { deprecated: true }})
          allTags: tags(orderBy: [order_ASC], first: 5) {
            order
            tag {
              title
              deprecated
            }
          }
          filteredTags: tags(where: { tag_not: { deprecated: true }}, orderBy: [order_ASC], first: 5) {
            order
            tag {
              title
            }
          }
        }`,
      },
      [],
    ],
    [
      'Article',
      myAdminContext,
      {
        where: { tagCount_gt: 1 },
        orderBy: ['createdAt_ASC'],
        first: 1,
        selection: `{
          title
          second: tags(orderBy: [order_ASC], skip: 1, first: 1) {
            order
          }
          penultimate: tags(orderBy: [order_DESC], skip: 1, first: 1) {
            order
          }
          all: tags(orderBy: [order_ASC], first: 10) {
            order
          }
        }`,
      },
      [
        {
          title: 'My first published article',
          second: [{ order: 1 }],
          penultimate: [{ order: 0 }],
          all: [{ order: 0 }, { order: 1 }],
        },
      ],
    ],
    [
      'Category',
      myAdminContext,
      {
        where: { parent: null },
        first: 1,
        selection: `{
          title
          childCount
          children(first: 10) {
            parent { title }
            title 
          }
        }`,
      },
      [
        {
          title: 'ROOT',
          childCount: 2,
          children: [
            {
              title: 'Home',
              parent: { title: 'ROOT' },
            },
            {
              title: 'News',
              parent: { title: 'ROOT' },
            },
          ],
        },
      ],
    ],
  ])(
    '%# - generates statements',
    async (nodeName, context, args, expectedResult) => {
      executedStatements.length = 0;

      await expect(
        gp
          .getNodeByName(nodeName)
          .getQueryByKey('find-many')
          .execute(context, args),
      ).resolves.toEqual(expectedResult);

      expect(executedStatements).toMatchSnapshot();
    },
  );
});
