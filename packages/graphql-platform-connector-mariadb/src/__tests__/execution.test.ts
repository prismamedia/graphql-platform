import { BoundOff } from '@prismamedia/ts-async-event-emitter';
import { Connection, format } from 'mysql';
import { format as beautify } from 'sql-formatter';
import { play, scenario } from '../../../graphql-platform-core/src/__tests__/execution/scenario';
import { Connector, ConnectorEventKind, Database } from '../graphql-platform/connector';
import { config, MyGP } from './gp';

describe('Execution', () => {
  let gp: MyGP;
  let connector: Connector;
  let database: Database;

  let connectionSet = new Set<Connection['threadId']>();
  let queries: string[] = [];
  let offListeners: BoundOff[];

  beforeAll(async done => {
    gp = new MyGP(config);
    connector = gp.getConnector();
    database = connector.getDatabase();

    await database.reset();

    done();
  });

  beforeEach(async done => {
    await gp.loadFixtures();

    offListeners = connector.onConfig({
      [ConnectorEventKind.PreStartTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('START TRANSACTION;');
      },
      [ConnectorEventKind.PreCommitTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('COMMIT;');
      },
      [ConnectorEventKind.PreRollbackTransaction]: ({ threadId }) => {
        connectionSet.add(threadId);
        queries.push('ROLLBACK;');
      },
      [ConnectorEventKind.PreQuery]: ({ threadId, sql, values }) => {
        connectionSet.add(threadId);
        queries.push(beautify(format(sql, values)));
      },
    });

    done();
  });

  afterEach(async done => {
    offListeners && offListeners.map(off => off());
    connectionSet.clear();
    queries.length = 0;

    await database.truncate();

    done();
  });

  afterAll(async () => database.drop());

  it.only('executes a scenario', async done => {
    await play(gp, scenario);

    expect(
      [`# ${queries.length} queries in ${connectionSet.size} connections`, ...queries].join('\n\n'),
    ).toMatchSnapshot();

    expect.assertions(scenario.length + 1);

    done();
  });
});
