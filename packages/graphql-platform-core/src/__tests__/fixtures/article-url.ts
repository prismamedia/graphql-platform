import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { Fixtures } from '../fixtures';

export function fixtures({ Article }: Fixtures): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  const articleReferences = Object.keys(Article);

  for (const articleReference of articleReferences) {
    if (faker.random.boolean()) {
      fixtureMap[`articleUrl_${articleReference}`] = {
        article: articleReference,
        path: faker.internet.url(),
      };
    }
  }

  return fixtureMap;
}
