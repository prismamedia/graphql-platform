import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import {
  myAdminContext,
  nodeNames,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as fixtures from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { createMyGP, type MyGP } from '../../__tests__/config.js';
import { NormalizeStatement } from './normalize.js';

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

      if (NormalizeStatement.normalizations(table).size) {
        const statement = new NormalizeStatement(table);

        expect(statement.sql).toMatchSnapshot();

        await expect(
          gp.connector.executeStatement(statement),
        ).resolves.toMatchSnapshot();
      } else {
        expect(
          () => new NormalizeStatement(table),
        ).toThrowErrorMatchingSnapshot();
      }
    },
  );
});
