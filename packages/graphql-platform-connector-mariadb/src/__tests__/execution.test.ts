import {
  play,
  scenario,
} from '@prismamedia/graphql-platform-core/src/__tests__/execution/scenario';
import { Connector, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Execution', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;

  beforeAll(async (done) => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();

    await database.reset();
    await gp.loadFixtures();

    done();
  });

  afterAll(async (done) => {
    await database.drop();

    done();
  });

  it('executes a scenario', async (done) => {
    // Ensure the timezone is well defined for both the system and the session
    await expect(
      gp
        .getConnector()
        .query([
          `SHOW GLOBAL VARIABLES LIKE 'time_zone';`,
          `SHOW SESSION VARIABLES LIKE 'time_zone';`,
        ]),
    ).resolves.toEqual([
      // System
      [{ Variable_name: 'time_zone', Value: 'SYSTEM' }],
      // Session
      [{ Variable_name: 'time_zone', Value: 'UTC' }],
    ]);

    await play(gp, scenario);

    expect.assertions(scenario.length + 1);

    done();
  });
});
