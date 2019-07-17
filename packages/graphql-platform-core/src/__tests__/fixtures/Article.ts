import { FixtureDataMap } from '../../graphql-platform/fixture';

export default {
  article_01: {
    format: 'Rich',
    title: "My first article's title, a rich article.",
    publishedAt: '2019-07-01T08:41:37.829+05:00',
    category: 'category_02',
    author: 'user_01',
  },
  article_02: {
    format: 'Video',
    title: "My second article's title, a video.",
    category: 'category_04',
    author: 'user_01',
    moderator: 'user_02',
    isImportant: true,
  },
  article_03: {
    format: 'Rich',
    title: "My third article's title, a video.",
    category: 'category_03',
    author: 'user_01',
    isImportant: false,
  },
} as FixtureDataMap;
