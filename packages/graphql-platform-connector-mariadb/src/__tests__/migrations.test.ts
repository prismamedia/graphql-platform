import { Connector, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Database', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;

  beforeAll(() => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();
  });

  beforeEach(async (done) => {
    await database.drop(true);

    done();
  });

  afterEach(async (done) => {
    await database.drop(true);

    done();
  });

  it('executes the migrations', async (done) => {
    const listTableStatement = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = '${database.name}'
      ORDER BY table_name ASC;
    `;

    // Empty database before the migrations
    await expect(connector.query(listTableStatement)).resolves.toEqual([]);

    await database.migrate();

    // 4 tables after the migrations : 2 new tables + the 2 for marv
    await expect(connector.query(listTableStatement)).resolves.toEqual(
      ['migrations', 'migrations_lock', 'my_new_table', 'my_other_table'].map(
        (table) => ({ table_name: table }),
      ),
    );

    done();
  });
});
