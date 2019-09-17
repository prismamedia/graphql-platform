import { play, scenario } from '../../../graphql-platform-core/src/__tests__/execution/scenario';
import { Connector, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Execution', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;

  beforeAll(async done => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();

    await database.reset();
    await gp.loadFixtures();

    done();
  });

  afterAll(async done => {
    await database.drop();

    done();
  });

  it('executes a scenario', async done => {
    await play(gp, scenario);

    expect.assertions(scenario.length);

    done();
  });
});
