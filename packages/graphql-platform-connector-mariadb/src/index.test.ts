import {
  myAdminContext,
  MyGP,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { EOL } from 'node:os';
import { MariaDBConnector } from './index.js';
import { makeGraphQLPlatform } from './__tests__/config.js';

describe('GraphQL Platform Connector MariaDB', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = makeGraphQLPlatform('index');

    await gp.connector.setup();
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it('generates valid and stable schema & statements', async () => {
    expect(
      gp.connector.schema.makeDropStatement({ ifExists: true }).statement,
    ).toMatchSnapshot();

    expect(
      gp.connector.schema.makeCreateStatement({ orReplace: true }).statement,
    ).toMatchSnapshot();

    expect(
      Array.from(
        gp.connector.schema.tablesByNode.values(),
        (table) => table.makeCreateStatement().statement,
      ).join(EOL.repeat(2)),
    ).toMatchSnapshot();

    expect(
      Array.from(gp.connector.schema.tablesByNode.values(), (table) =>
        table.foreignKeysByEdge.size
          ? table.makeAddForeignKeysStatement().statement
          : undefined,
      )
        .filter(Boolean)
        .join(EOL.repeat(2)),
    ).toMatchSnapshot();
  });

  it.skip('loads the fixtures', async () => {
    await gp.seed(fixtures, myAdminContext);
  });
});
