import faker from 'faker';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { FixturesConfig } from '../fixtures';

export function fixtures({ userCount }: FixturesConfig): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  for (let i = 0; i < userCount; i++) {
    fixtureMap[`user_${i}`] = {
      username: faker.name.firstName(),
    };
  }

  return fixtureMap;
}
