import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  myAdminContext,
  nodeNames,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
import {
  NormalizeStatement,
  type NormalizeStatementConfig,
} from './normalize.js';

describe('Normalize statement', () => {
  let gp: MyGP;

  beforeAll(async () => {
    gp = createMyGP(`connector_mariadb_normalize_statement`);

    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  afterAll(() => gp.connector.teardown());

  it.each(nodeNames)(
    'generates "normalize" statement for "%s"',
    async (nodeName) => {
      const table = gp.connector.schema.getTableByNode(nodeName);
      const config: NormalizeStatementConfig = {
        customize: ({ column, columnIdentifier, defaultNormalization }) =>
          column.table.name === 'articles' && column.name === 'title'
            ? `TRIM(${columnIdentifier})`
            : column.name === 'updated_at'
              ? columnIdentifier
              : defaultNormalization,
      };

      if (NormalizeStatement.normalizations(table, config).size) {
        const statement = new NormalizeStatement(table, config);

        expect(statement.sql).toMatchSnapshot();

        await expect(
          gp.connector.executeStatement(statement),
        ).resolves.toMatchSnapshot();
      } else {
        expect(
          () => new NormalizeStatement(table, config),
        ).toThrowErrorMatchingSnapshot();
      }
    },
  );
});
