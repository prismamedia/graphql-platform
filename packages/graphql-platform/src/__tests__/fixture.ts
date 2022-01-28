import { ArticleStatus } from './config.js';

export const Category = {
  category_root: {
    title: 'ROOT',
    order: 0,
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
} as const;

export const Article = {
  article_01: {
    category: 'category_news',
    title: 'My first draft article',
    body: {
      blocks: [],
      entityMap: {},
    },
    metas: {
      myArbitraryKey: 'with my arbitrary value',
    },
  },
  article_02: {
    category: 'category_news',
    title: 'My second draft article',
    status: ArticleStatus.DRAFT,
  },
  article_03: {
    category: 'category_news',
    title: 'My first published article',
    status: ArticleStatus.PUBLISHED,
  },
} as const;

export const Tag = {
  tag_01: {
    title: 'TV',
  },
  tag_02: {
    title: 'high-tech',
  },
  tag_03: {
    title: 'fashion',
    deprecated: true,
  },
} as const;

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
} as const;

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
} as const;

export const User = {
  user_yvann: {
    id: 'c395757e-8a40-456a-b006-221ef3490456',
    username: 'yvann',
  },
  user_marine: {
    id: '654173f4-8fa6-42df-9941-f5a6a4d0b97e',
    username: 'marine',
  },
} as const;

export const UserProfile = {
  user_profile_yvann: {
    user: 'user_yvann',
    birthday: '1987-04-28',
    twitterHandle: '@yvannboucher',
  },
} as const;

export const fixtures = {
  Category,
  Article,
  Tag,
  ArticleTag,
  ArticleTagModeration,
  User,
  UserProfile,
} as const;
