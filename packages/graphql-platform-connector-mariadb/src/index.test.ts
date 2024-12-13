import { createMyGP as baseCreateMyGP } from '@prismamedia/graphql-platform/__tests__/config.js';
import * as mariadb from 'mariadb';
import assert from 'node:assert';
import { EOL } from 'node:os';
import { before, describe, it } from 'node:test';
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

  before(async () => {
    gp = createMyGP('connector_mariadb');
  });

  it('generates a consistent schema', async ({ assert: { snapshot } }) => {
    snapshot(
      new DropSchemaStatement(gp.connector.schema, { ifExists: true }).sql,
    );

    snapshot(
      new CreateSchemaStatement(gp.connector.schema, { orReplace: true }).sql,
    );

    snapshot(
      Array.from(
        gp.connector.schema.tablesByNode.values(),
        (table) => new CreateTableStatement(table).sql,
      ).join(EOL.repeat(2)),
    );

    snapshot(
      Array.from(gp.connector.schema.tablesByNode.values(), (table) =>
        table.foreignKeysByEdge.size
          ? new AddTableForeignKeysStatement(table, table.foreignKeys).sql
          : undefined,
      )
        .filter(Boolean)
        .join(EOL.repeat(2)),
    );
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

    await assert.rejects(
      () => gp.connector.withConnection((connection) => connection.ping()),
      mariadb.SqlError,
    );
  });
});
