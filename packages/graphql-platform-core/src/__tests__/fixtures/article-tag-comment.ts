import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { Fixtures } from '../fixtures';

export function fixtures({ ArticleTag }: Fixtures): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  const articleTagReferences = Object.keys(ArticleTag);

  for (const articleTagReference of articleTagReferences) {
    if (faker.random.boolean()) {
      fixtureMap[`articleTagComment_${articleTagReference}`] = {
        articleTag: articleTagReference,
        body: faker.lorem.sentence(1, 10),
      };
    }
  }

  return fixtureMap;
}
