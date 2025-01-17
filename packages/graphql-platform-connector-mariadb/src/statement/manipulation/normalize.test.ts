import {
  myAdminContext,
  nodeNames,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { inspect } from 'node:util';
import { createMyGP } from '../../__tests__/config.js';
import {
  NormalizeStatement,
  type NormalizeStatementConfig,
} from './normalize.js';

describe('Normalize statement', () => {
  const gp = createMyGP(`connector_mariadb_normalize_statement`);

  before(async () => {
    await gp.connector.setup();
    await gp.seed(myAdminContext, fixtures.constant);
  });

  after(() => gp.connector.teardown());

  nodeNames.forEach((nodeName) => {
    it(`generates "normalize" statement for "${nodeName}"`, async ({
      assert: { snapshot },
    }) => {
      const table = gp.connector.schema.getTableByNode(nodeName);
      const config: NormalizeStatementConfig = {
        customize: ({ column, columnIdentifier, defaultNormalization }) =>
          column.name === 'updated_at'
            ? columnIdentifier
            : defaultNormalization,
      };

      if (NormalizeStatement.normalizations(table, config).size) {
        const statement = new NormalizeStatement(table, config);
        snapshot(statement.sql);
        snapshot(await gp.connector.executeStatement(statement), {
          serializers: [inspect],
        });
      } else {
        assert.throws(() => new NormalizeStatement(table, config));
      }
    });
  });
});
