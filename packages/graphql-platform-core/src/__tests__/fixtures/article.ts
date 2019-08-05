import { getEnumKeys } from '@prismamedia/graphql-platform-utils';
import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { Fixtures, FixturesConfig } from '../fixtures';
import { ArticleFormat } from '../resources/Article';

const formats = getEnumKeys(ArticleFormat);

export function fixtures(
  { articleCount, dateReference }: FixturesConfig,
  { Category, User }: Fixtures,
): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  const categoryReferences = Object.keys(Category);
  const userReferences = Object.keys(User);

  for (let i = 0; i < articleCount; i++) {
    fixtureMap[`article_${i}`] = {
      format: faker.random.arrayElement(formats),
      title: faker.lorem.sentence(2, 5),
      body: faker.lorem.sentence(5, 10),
      isImportant: faker.random.boolean(),
      publishedAt: faker.random.boolean() ? faker.date.past(undefined, dateReference).toISOString() : null,
      category: faker.random.arrayElement(categoryReferences),
      author: faker.random.arrayElement(userReferences),
      moderator: faker.random.boolean() ? faker.random.arrayElement(userReferences) : null,
    };
  }

  return fixtureMap;
}
