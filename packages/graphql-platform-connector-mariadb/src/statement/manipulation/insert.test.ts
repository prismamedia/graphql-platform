import * as core from '@prismamedia/graphql-platform';
import {
  myAdminContext,
  myJournalistContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import assert from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { createMyGP } from '../../__tests__/config.js';
import { InsertStatement } from './insert.js';

describe('Insert statement', () => {
  const gp = createMyGP(`connector_mariadb_insert_statement`);
  gp.connector.on('executed-statement', ({ statement }) => {
    if (statement instanceof InsertStatement) {
      executedStatements.push(statement.sql);
    }
  });

  const executedStatements: string[] = [];

  before(async () => {
    await gp.connector.setup();
  });

  after(() => gp.connector.teardown());

  it('generates a single creation', async () => {
    executedStatements.length = 0;

    assert.deepEqual(
      await gp.api.User.createOne(myAdminContext, {
        data: {
          id: '484ae4db-a944-421d-828c-3b514a438146',
          username: 'myTestUser',
          createdAt: new Date('2022-02-01T12:00:00Z'),
          lastLoggedInAt: null,
        },
        selection: `{ 
          id
          username
          createdAt
          lastLoggedInAt
        }`,
      }),
      {
        id: '484ae4db-a944-421d-828c-3b514a438146',
        username: 'myTestUser',
        createdAt: new Date('2022-02-01T12:00:00Z'),
        lastLoggedInAt: null,
      },
    );

    assert.deepEqual(executedStatements, [
      `INSERT INTO \`users\`
  (\`id\`,\`username\`,\`created_at\`,\`last_logged_in_at\`)
VALUES
  ('484ae4db-a944-421d-828c-3b514a438146','myTestUser','2022-02-01 12:00:00.000',NULL)
RETURNING
  \`id\`,\`username\`,\`created_at\`,\`last_logged_in_at\``,
    ]);
  });

  it('generates multiple creations', async () => {
    executedStatements.length = 0;

    const now = new Date();

    assert.deepEqual(
      await gp.api.Article.createSome(myJournalistContext, {
        data: [
          {
            id: '484ae4db-a944-421d-828c-3b514a438146',
            title: '  My first title  ',
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'f96e220e-ae7b-487e-b62a-09dc446f0c7d',
            title: 'My second title',
            body: {
              blocks: [],
              entityMap: {},
            },
            createdAt: now,
            updatedAt: now,
            sponsored: true,
            views: 12n,
            score: 0.753,
            machineTags: ['namespace:key=a_value', 'namespace:key=other_value'],
            metas: { aKey: 'withAnyValue' },
          },
        ],
        selection: `{ 
          id
          title
          body
          createdAt
          updatedAt
          sponsored
          views
          score
          machineTags
          metas
        }`,
      }),
      [
        {
          id: '484ae4db-a944-421d-828c-3b514a438146',
          title: 'My first title',
          body: null,
          createdAt: now,
          updatedAt: new Date(
            now.toISOString().replace(/^([^.]+).+$/, '$1.000Z'),
          ),
          sponsored: null,
          views: 0n,
          score: 0.5,
          machineTags: null,
          metas: null,
        },
        {
          id: 'f96e220e-ae7b-487e-b62a-09dc446f0c7d',
          title: 'My second title',
          body: {
            blocks: [],
            entityMap: {},
          },
          createdAt: now,
          updatedAt: new Date(
            now.toISOString().replace(/^([^.]+).+$/, '$1.000Z'),
          ),
          sponsored: true,
          views: 12n,
          score: 0.75,
          machineTags: ['namespace:key=a_value', 'namespace:key=other_value'],
          metas: { aKey: 'withAnyValue' },
        },
      ],
    );

    const serializedNow = now
      .toISOString()
      .replace(/^(?<date>[^T]+)T(?<time>[^Z]+)Z$/, '$<date> $<time>');

    assert.deepEqual(executedStatements, [
      `INSERT INTO \`articles\`
  (\`private_id\`,\`id\`,\`status\`,\`title\`,\`slug\`,\`body\`,\`category_private_id\`,\`created_by_id\`,\`created_at\`,\`updated_by_username\`,\`updated_at\`,\`metas\`,\`highlighted\`,\`sponsored\`,\`views\`,\`score\`,\`machine_tags\`)
VALUES
  (NULL,'484ae4db-a944-421d-828c-3b514a438146','draft','My first title','my-first-title',NULL,NULL,NULL,'${serializedNow}',NULL,'${serializedNow}',NULL,NULL,NULL,0,0.5,NULL),
  (NULL,'f96e220e-ae7b-487e-b62a-09dc446f0c7d','draft','My second title','my-second-title','{\\\"entityMap\\\":{},\\\"blocks\\\":[]}',NULL,NULL,'${serializedNow}',NULL,'${serializedNow}','{\\\"aKey\\\":\\\"withAnyValue\\\"}',NULL,1,12,0.753,'[\\\"namespace:key=a_value\\\",\\\"namespace:key=other_value\\\"]')
RETURNING
  \`private_id\`,\`id\`,\`status\`,\`title\`,\`slug\`,\`body\`,\`category_private_id\`,\`created_by_id\`,\`created_at\`,\`updated_by_username\`,\`updated_at\`,\`metas\`,\`highlighted\`,\`sponsored\`,\`views\`,\`score\`,\`machine_tags\``,
    ]);
  });

  it('throws a duplicate error', async () => {
    executedStatements.length = 0;

    await assert.rejects(
      () =>
        gp.api.Article.createOne(myAdminContext, {
          data: {
            id: '484ae4db-a944-421d-828c-3b514a438146',
            title: 'My title',
          },
          selection: `{ id }`,
        }),
      core.DuplicateError,
    );
  });
});
