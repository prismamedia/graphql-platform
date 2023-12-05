import { beforeAll, describe, expect, it } from '@jest/globals';
import { createMyGP as baseCreateMyGP } from '@prismamedia/graphql-platform/__tests__/config.js';
import * as mariadb from 'mariadb';
import { EOL } from 'node:os';
import { createMyGP, type MyGP } from './__tests__/config.js';
import {
  AddTableForeignKeysStatement,
  CreateSchemaStatement,
  CreateTableStatement,
  DropSchemaStatement,
  MariaDBConnector,
} from './index.js';

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

  it('throws error on fatal pool error', async () => {
    const gp = baseCreateMyGP({
      connector: (gp) =>
        new MariaDBConnector(gp, {
          pool: {
            host: 'mariadb',
            user: 'root',
            database: 'my_unknown_database',
            acquireTimeout: 50,
          },
        }),
    });

    await expect(
      gp.connector.withConnection((connection) => connection.ping()),
    ).rejects.toThrowError(mariadb.SqlError);
  });
});
