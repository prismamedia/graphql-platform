import faker from 'faker';
import { FixtureDataMap } from '../graphql-platform/fixture';
import { Resource } from '../graphql-platform/resource';
import { fixtures as articles } from './fixtures/article';
import { fixtures as articleTags } from './fixtures/article-tag';
import { fixtures as articleTagComments } from './fixtures/article-tag-comment';
import { fixtures as articleUrls } from './fixtures/article-url';
import { fixtures as articleUrlMetas } from './fixtures/article-url-meta';
import { fixtures as categories } from './fixtures/category';
import { fixtures as tags } from './fixtures/tag';
import { fixtures as users } from './fixtures/user';

export type FixturesConfig = {
  articleCount: number;
  categoryCount: number;
  tagCount: number;
  userCount: number;

  dateReference: Date;
};

export const defaultConfig: FixturesConfig = {
  articleCount: 10,
  categoryCount: 5,
  tagCount: 5,
  userCount: 5,

  dateReference: new Date('2019-01-01T00:00:00.000Z'),
};

export type Fixtures = Record<Resource['name'], FixtureDataMap>;

let cache: Fixtures;
export function fixtures(config: FixturesConfig = defaultConfig): Fixtures {
  if (cache) {
    return cache;
  }

  faker.seed(1);

  const fixtures: Fixtures = {
    Category: categories(config),
    Tag: tags(config),
    User: users(config),
  };

  Object.assign(fixtures, {
    Article: articles(config, fixtures),
  });

  Object.assign(fixtures, {
    ArticleTag: articleTags(fixtures),
    ArticleUrl: articleUrls(fixtures),
  });

  Object.assign(fixtures, {
    ArticleUrlMeta: articleUrlMetas(fixtures),
    ArticleTagComment: articleTagComments(fixtures),
  });

  return (cache = fixtures);
}
