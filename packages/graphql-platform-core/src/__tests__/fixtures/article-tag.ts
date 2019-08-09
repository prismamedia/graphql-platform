import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { Fixtures } from '../fixtures';

export function fixtures({ Article, Tag }: Fixtures): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  const articleReferences = Object.keys(Article);
  const tagReferences = Object.keys(Tag);

  for (const articleReference of articleReferences) {
    const tagCount = faker.random.number({ min: 0, max: 3 });
    for (let order = 0; order < tagCount; order++) {
      const tagReference = faker.random.arrayElement(tagReferences);

      fixtureMap[`articleTag_${articleReference}-${tagReference}`] = {
        order,
        article: articleReference,
        tag: tagReference,
      };
    }
  }

  return fixtureMap;
}
