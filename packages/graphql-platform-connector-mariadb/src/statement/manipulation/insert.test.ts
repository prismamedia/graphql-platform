import {
  myAdminContext,
  MyGP,
  myJournalistContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { MariaDBConnector } from '../../index.js';
import { createGraphQLPlatform } from '../../__tests__/config.js';
import { InsertStatement } from './insert.js';

describe('Insert statement', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = createGraphQLPlatform('connector_mariadb_insert_statement');

    await gp.connector.setup();
  });

  afterAll(async () => {
    await gp.connector.teardown();
  });

  it('generates a single creation', async () => {
    const statements: string[] = [];

    const subscriber = gp.connector.executedStatements.subscribe(
      ({ statement }) => {
        if (
          statement instanceof InsertStatement &&
          statement.table.name === 'users'
        ) {
          statements.push(statement.sql);
        }
      },
    );

    try {
      await expect(
        gp.api.mutation.createUser(
          {
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
          },
          myAdminContext,
        ),
      ).resolves.toEqual({
        id: '484ae4db-a944-421d-828c-3b514a438146',
        username: 'myTestUser',
        createdAt: new Date('2022-02-01T12:00:00Z'),
        lastLoggedInAt: null,
      });
    } finally {
      subscriber.unsubscribe();
    }

    expect(statements).toEqual([
      `INSERT INTO \`users\`
  (\`id\`,\`username\`,\`created_at\`,\`last_logged_in_at\`)
VALUES
  ('484ae4db-a944-421d-828c-3b514a438146','myTestUser','2022-02-01 12:00:00.000',NULL)
RETURNING
  \`id\`,\`username\`,\`created_at\`,\`last_logged_in_at\``,
    ]);
  });

  it('generates multiple creations', async () => {
    const statements: string[] = [];

    const subscriber = gp.connector.executedStatements.subscribe(
      ({ statement }) => {
        if (
          statement instanceof InsertStatement &&
          statement.table.name === 'articles'
        ) {
          statements.push(statement.sql);
        }
      },
    );

    const now = new Date();

    try {
      await expect(
        gp.api.mutation.createArticles(
          {
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
                machineTags: [
                  'namespace:key=a_value',
                  'namespace:key=other_value',
                ],
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
          },
          myJournalistContext,
        ),
      ).resolves.toEqual([
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
      ]);
    } finally {
      subscriber.unsubscribe();
    }

    const serializedNow = now
      .toISOString()
      .replace(/^(?<date>[^T]+)T(?<time>[^Z]+)Z$/, '$<date> $<time>');

    expect(statements).toEqual([
      `INSERT INTO \`articles\`
  (\`privateId\`,\`id\`,\`status\`,\`title\`,\`slug\`,\`body\`,\`category_privateId\`,\`created_by_id\`,\`created_at\`,\`updated_by_username\`,\`updated_at\`,\`metas\`,\`highlighted\`,\`sponsored\`,\`views\`,\`score\`,\`machine_tags\`)
VALUES
  (NULL,'484ae4db-a944-421d-828c-3b514a438146','draft','My first title','my-first-title',NULL,NULL,NULL,'${serializedNow}',NULL,'${serializedNow}',NULL,NULL,NULL,0,0.5,NULL),
  (NULL,'f96e220e-ae7b-487e-b62a-09dc446f0c7d','draft','My second title','my-second-title','{\\\"entityMap\\\":{},\\\"blocks\\\":[]}',NULL,NULL,'${serializedNow}',NULL,'${serializedNow}','{\\\"aKey\\\":\\\"withAnyValue\\\"}',NULL,1,12,0.753,'[\\\"namespace:key=a_value\\\",\\\"namespace:key=other_value\\\"]')
RETURNING
  \`privateId\`,\`id\`,\`status\`,\`title\`,\`slug\`,\`body\`,\`category_privateId\`,\`created_by_id\`,\`created_at\`,\`updated_by_username\`,\`updated_at\`,\`metas\`,\`highlighted\`,\`sponsored\`,\`views\`,\`score\`,\`machine_tags\``,
    ]);
  });
});
