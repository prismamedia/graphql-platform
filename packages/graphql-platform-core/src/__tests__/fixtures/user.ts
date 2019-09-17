import faker from 'faker';
import slug from 'slug';
import { FixtureDataMap } from '../../graphql-platform/fixture';
import { FixturesConfig } from '../fixtures';

export function fixtures({ userCount }: FixturesConfig): FixtureDataMap {
  const fixtureMap: FixtureDataMap = Object.create(null);

  for (let i = 0; i < userCount; i++) {
    fixtureMap[`user_${i}`] = {
      id: faker.random.uuid(),
      username: slug(faker.name.firstName(), { lower: true }),
    };
  }

  return fixtureMap;
}
