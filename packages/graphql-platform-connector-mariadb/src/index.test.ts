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

    await gp.connector.reset();
  });

  afterAll(async () => {
    try {
      await gp.connector.schema.drop({ ifExists: true });
    } finally {
      await gp.connector.pool.end();
    }
  });

  it('generates valid and stable schema & statements', async () => {
    const schema = gp.connector.schema;

    expect(
      schema.makeDropStatement({ ifExists: true }).statement,
    ).toMatchSnapshot();

    expect(
      schema.makeCreateStatement({ orReplace: true }).statement,
    ).toMatchSnapshot();

    expect(
      Array.from(
        schema.tablesByNode.values(),
        (table) => table.makeCreateStatement().statement,
      ).join(EOL.repeat(2)),
    ).toMatchSnapshot();

    expect(
      Array.from(schema.tablesByNode.values(), (table) =>
        table.foreignKeysByEdge.size
          ? table.makeAddForeignKeysStatement().statement
          : undefined,
      )
        .filter(Boolean)
        .join(EOL.repeat(2)),
    ).toMatchSnapshot();
  });

  it('loads the fixtures', async () => {
    await gp.seed(fixtures, myAdminContext, false);
  });
});
