import {
  myAdminContext,
  MyGP,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { EOL } from 'node:os';
import {
  AddTableForeignKeysStatement,
  CreateSchemaStatement,
  CreateTableStatement,
  DropSchemaStatement,
  MariaDBConnector,
} from './index.js';
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

  it('generates valid and stable schema', async () => {
    expect(
      new DropSchemaStatement(gp.connector.schema, { ifExists: true }).sql,
    ).toMatchSnapshot();

    expect(
      new CreateSchemaStatement(gp.connector.schema, { orReplace: true }).sql,
    ).toMatchSnapshot();

    expect(
      Array.from(
        gp.connector.schema.tablesByNode.values(),
        (table) => new CreateTableStatement(table).sql,
      ).join(EOL.repeat(2)),
    ).toMatchSnapshot();

    expect(
      Array.from(gp.connector.schema.tablesByNode.values(), (table) =>
        table.foreignKeyIndexesByEdge.size
          ? new AddTableForeignKeysStatement(table).sql
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
