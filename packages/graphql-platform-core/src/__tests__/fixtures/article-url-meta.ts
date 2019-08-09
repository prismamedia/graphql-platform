import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { Fixtures } from '../fixtures';

export function fixtures({ ArticleUrl }: Fixtures): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  const articleUrlReferences = Object.keys(ArticleUrl);

  for (const articleUrlReference of articleUrlReferences) {
    if (faker.random.boolean()) {
      fixtureMap[`articleUrlMeta_${articleUrlReference}`] = {
        url: articleUrlReference,
      };
    }
  }

  return fixtureMap;
}
