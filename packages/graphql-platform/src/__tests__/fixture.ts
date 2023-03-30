import type {
  NodeFixtureDataByReference,
  NodeFixtureDataByReferenceByNodeName,
} from '../seeding.js';
import { ArticleStatus } from './config.js';

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

export const ArticleTag = {
  'article_03-tag_01': {
    article: 'article_03',
    tag: 'tag_01',
    order: 0,
  },
  'article_03-tag_02': {
    article: 'article_03',
    tag: 'tag_02',
    order: 1,
  },
  'article_04-tag_03': {
    article: 'article_04',
    tag: 'tag_03',
    order: 0,
  },
} satisfies NodeFixtureDataByReference;

export const ArticleTagModeration = {
  'article_03-tag_02-moderator_user_yvann': {
    articleTag: 'article_03-tag_02',
    moderator: 'user_yvann',
    moderation: 'Not the best tag here',
  },
  'article_03-tag_02-moderator_user_marine': {
    articleTag: 'article_03-tag_02',
    moderator: 'user_marine',
    moderation: 'I would like to delete it',
  },
} satisfies NodeFixtureDataByReference;

export const User = {
  user_yvann: {
    id: 'c395757e-8a40-456a-b006-221ef3490456',
    username: 'yvann',
    createdAt: new Date('2022-01-01T10:00:00Z'),
    lastLoggedInAt: new Date('2022-01-01T12:00:00Z'),
  },
  user_marine: {
    id: '654173f4-8fa6-42df-9941-f5a6a4d0b97e',
    username: 'marine',
    createdAt: new Date('2022-02-01T12:00:00Z'),
    lastLoggedInAt: null,
  },
} satisfies NodeFixtureDataByReference;

export const UserProfile = {
  user_profile_yvann: {
    user: 'user_yvann',
    birthday: '1987-04-28',
    twitterHandle: '@yvannboucher',
  },
} satisfies NodeFixtureDataByReference;

export const fixtures = {
  Category,
  Article,
  Tag,
  ArticleTag,
  ArticleTagModeration,
  User,
  UserProfile,
} satisfies NodeFixtureDataByReferenceByNodeName;
