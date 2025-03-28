import type {
  FindManyQueryArgs,
  Node,
  NodeSelectedValue,
} from '@prismamedia/graphql-platform';
import {
  ArticleStatus,
  myAdminContext,
  myUserContext,
  type MyContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { format } from '@sqltools/formatter';
import assert from 'node:assert';
import { EOL } from 'node:os';
import { after, before, describe, it } from 'node:test';
import { createMyGP } from '../../__tests__/config.js';

describe('Find statement', () => {
  const gp = createMyGP(`connector_mariadb_find_statement`);
  gp.connector.on('executed-statement', ({ statement }) =>
    executedStatements.push(format(statement.sql).replaceAll('<= >', '<=>')),
  );

  const executedStatements: string[] = [];

  before(async () => {
    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  after(() => gp.connector.teardown());

  (
    [
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
            a: lowerCasedTitle
            b: lowerCasedTitle
            upperCasedTitle
            c: mixedCasedTitle
            d: mixedCasedTitle
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
            a: 'published-my first published article-news',
            b: 'published-my first published article-news',
            upperCasedTitle:
              'PUBLISHED-MY FIRST PUBLISHED ARTICLE-NEWS-TV-HIGH-TECH',
            c: 'published-my first published article-news / PUBLISHED-MY FIRST PUBLISHED ARTICLE-NEWS-TV-HIGH-TECH',
            d: 'published-my first published article-news / PUBLISHED-MY FIRST PUBLISHED ARTICLE-NEWS-TV-HIGH-TECH',
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
            a: 'published-my second published article-home',
            b: 'published-my second published article-home',
            upperCasedTitle:
              'PUBLISHED-MY SECOND PUBLISHED ARTICLE-HOME-FASHION',
            c: 'published-my second published article-home / PUBLISHED-MY SECOND PUBLISHED ARTICLE-HOME-FASHION',
            d: 'published-my second published article-home / PUBLISHED-MY SECOND PUBLISHED ARTICLE-HOME-FASHION',
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
            a: 'published-my first published article in root category-root',
            b: 'published-my first published article in root category-root',
            upperCasedTitle:
              'PUBLISHED-MY FIRST PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT-TV-HIGH-TECH',
            c: 'published-my first published article in root category-root / PUBLISHED-MY FIRST PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT-TV-HIGH-TECH',
            d: 'published-my first published article in root category-root / PUBLISHED-MY FIRST PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT-TV-HIGH-TECH',
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
            a: 'published-my second published article in root category-root',
            b: 'published-my second published article in root category-root',
            upperCasedTitle:
              'PUBLISHED-MY SECOND PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT-TV-FASHION',
            c: 'published-my second published article in root category-root / PUBLISHED-MY SECOND PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT-TV-FASHION',
            d: 'published-my second published article in root category-root / PUBLISHED-MY SECOND PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT-TV-FASHION',
          },
          {
            body: null,
            createdAt: new Date('2022-07-01T00:00:00.000Z'),
            machineTags: null,
            metas: null,
            score: 0.5,
            status: 'published',
            tagCount: 0,
            title: 'My third published article in root category',
            views: 0n,
            a: 'published-my third published article in root category-root',
            b: 'published-my third published article in root category-root',
            upperCasedTitle:
              'PUBLISHED-MY THIRD PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT',
            c: 'published-my third published article in root category-root / PUBLISHED-MY THIRD PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT',
            d: 'published-my third published article in root category-root / PUBLISHED-MY THIRD PUBLISHED ARTICLE IN ROOT CATEGORY-ROOT',
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
          where: { category_is_null: true },
          first: 5,
          selection: `{
            title
            category { _id }
          }`,
        },
        [],
      ],
      [
        'Article',
        myAdminContext,
        {
          where: { category: { _id: 5 } },
          first: 5,
          selection: `{
            title
            category { _id }
          }`,
        },
        [],
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
        'Article',
        myAdminContext,
        {
          where: { tags_every: { tag: { deprecated: true } } },
          first: 5,
          selection: `{
            title
            tags(first: 10) {
              tag {
                deprecated
              }
            }
          }`,
        },
        [
          {
            title: 'My first draft article',
            tags: [],
          },
          {
            title: 'My second draft article',
            tags: [],
          },
          {
            title: 'My second published article',
            tags: [{ tag: { deprecated: true } }],
          },
          {
            title: 'My third published article in root category',
            tags: [],
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
      [
        'ArticleTagModeration',
        myAdminContext,
        {
          where: {
            moderation_is_null: false,
            articleTag: {
              article: { _id: 5 },
              tag: { id: '5d6e37f3-0416-4f4a-a405-66b67cc590b9' },
            },
          },
          first: 1,
          selection: `{
            moderation
            articleTag {
              article { _id },
              tag { id },
            },
          }`,
        },
        [],
      ],
    ] satisfies ReadonlyArray<
      [Node['name'], MyContext, FindManyQueryArgs, NodeSelectedValue[]]
    >
  ).forEach(([nodeName, context, args, expectedResult], index) => {
    it(`#${index}: generates statements for ${nodeName}`, async ({
      assert: { snapshot },
    }) => {
      executedStatements.length = 0;

      assert.deepEqual(
        await gp.api[nodeName].findMany(context, args),
        expectedResult,
      );

      snapshot(executedStatements.map((sql) => sql.split(EOL)));
    });
  });
});
