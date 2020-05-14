import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { FixturesConfig } from '../fixtures';

export function fixtures({ tagCount }: FixturesConfig): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  for (let i = 0; i < tagCount; i++) {
    fixtureMap[`tag_${i}`] = {
      id: faker.random.uuid(),
      title: `${faker.random.words(
        faker.random.number({ min: 1, max: 3 }),
      )} #${i}`,
    };
  }

  return fixtureMap;
}
