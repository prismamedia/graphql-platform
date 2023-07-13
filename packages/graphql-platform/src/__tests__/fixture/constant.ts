import type {
  NodeFixtureDataByReference,
  NodeFixtureDataByReferenceByNodeName,
} from '../../seeding.js';
import { ArticleStatus } from '../config.js';

export const Category = {
  category_root: {
    order: 0,
    title: 'ROOT',
  },
  category_home: {
    parent: 'category_root',
    order: 0,
    title: 'Home',
  },
  category_news: {
    parent: 'category_root',
    order: 1,
    title: 'News',
  },
} satisfies NodeFixtureDataByReference;

export const Tag = {
  tag_01: {
    title: 'TV',
  },
  tag_02: {
    title: 'High-tech',
  },
  tag_03: {
    title: 'Fashion',
    deprecated: true,
  },
} satisfies NodeFixtureDataByReference;

export const User = {
  user_yvann: {
    id: 'c395757e-8a40-456a-b006-221ef3490456',
    username: 'yvann',
    createdAt: new Date('2022-01-01T10:00:00Z'),
    lastLoggedInAt: new Date('2022-01-01T12:00:00Z'),
    profile: {
      birthday: '1987-04-28',
      twitterHandle: '@yvannboucher',
    },
  },
  user_marine: {
    id: '654173f4-8fa6-42df-9941-f5a6a4d0b97e',
    username: 'marine',
    createdAt: new Date('2022-02-01T12:00:00Z'),
    lastLoggedInAt: null,
  },
} satisfies NodeFixtureDataByReference;

export const Article = {
  article_01: {
    category: 'category_home',
    title: 'My first draft article',
    body: {
      blocks: [],
      entityMap: {},
    },
    metas: {
      myArbitraryKey: 'with my arbitrary value',
    },
    createdAt: new Date('2022-01-01T00:00:00Z'),
  },
  article_02: {
    category: 'category_home',
    title: 'My second draft article',
    status: ArticleStatus.DRAFT,
    createdAt: new Date('2022-02-01T00:00:00Z'),
  },
  article_03: {
    category: 'category_news',
    title: 'My first published article',
    status: ArticleStatus.PUBLISHED,
    createdAt: new Date('2022-03-01T00:00:00Z'),
    createdBy: 'user_marine',
    tags: [
      {
        tag: 'tag_01',
        order: 0,
      },
      {
        tag: 'tag_02',
        order: 1,
        moderations: [
          {
            moderator: 'user_yvann',
            moderation: 'Not the best tag here',
          },
          {
            moderator: 'user_marine',
            moderation: 'I would like to delete it',
          },
        ],
      },
    ],
  },
  article_04: {
    category: 'category_home',
    title: 'My second published article',
    status: ArticleStatus.PUBLISHED,
    body: {
      blocks: [],
      entityMap: {},
    },
    createdAt: new Date('2022-04-01T00:00:00Z'),
    views: 1234567890n,
    score: 0.123,
    machineTags: ['namespace:key=a_value', 'namespace:key=other_value'],
    metas: { aKey: 'withAnyValue' },
    extension: { source: "My second published article's source" },
    tags: [
      {
        tag: 'tag_03',
        order: 0,
        moderations: {
          moderator: 'user_yvann',
          moderation: 'Perfect tag',
        },
      },
    ],
  },
  article_05: {
    category: 'category_root',
    title: 'My first published article in root category',
    status: ArticleStatus.PUBLISHED,
    tags: [
      {
        tag: 'tag_01',
        order: 0,
      },
      {
        tag: 'tag_02',
        order: 1,
      },
      {
        tag: 'tag_03',
        order: 2,
      },
    ],
    createdAt: new Date('2022-05-01T00:00:00Z'),
    createdBy: 'user_yvann',
  },
  article_06: {
    category: 'category_root',
    title: 'My second published article in root category',
    status: ArticleStatus.PUBLISHED,
    tags: [
      {
        tag: 'tag_01',
        order: 0,
      },
      {
        tag: 'tag_03',
        order: 1,
      },
    ],
    createdAt: new Date('2022-06-01T00:00:00Z'),
    createdBy: 'user_yvann',
  },
} satisfies NodeFixtureDataByReference;

export default {
  Article,
  Category,
  Tag,
  User,
} satisfies NodeFixtureDataByReferenceByNodeName;
