import { beforeAll, describe, expect, it } from '@jest/globals';
import { EOL } from 'node:os';
import {
  AddTableForeignKeysStatement,
  CreateSchemaStatement,
  CreateTableStatement,
  DropSchemaStatement,
} from './index.js';
import { createMyGP, type MyGP } from './__tests__/config.js';

describe('GraphQL-Platform Connector MariaDB', () => {
  let gp: MyGP;

  beforeAll(async () => {
    gp = createMyGP('connector_mariadb');
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
        table.foreignKeysByEdge.size
          ? new AddTableForeignKeysStatement(table).sql
          : undefined,
      )
        .filter(Boolean)
        .join(EOL.repeat(2)),
    ).toMatchSnapshot();
  });
});
