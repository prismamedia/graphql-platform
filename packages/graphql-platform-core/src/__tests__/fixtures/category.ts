import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { FixturesConfig } from '../fixtures';

export function fixtures({ categoryCount }: FixturesConfig): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  fixtureMap['category_0'] = {
    title: 'Root category',
  };

  for (let i = 1; i < categoryCount; i++) {
    fixtureMap[`category_${i}`] = {
      parent: faker.random.arrayElement(Object.keys(fixtureMap)),
      title: faker.lorem.words(faker.random.number({ min: 1, max: 3 })),
    };
  }

  return fixtureMap;
}
