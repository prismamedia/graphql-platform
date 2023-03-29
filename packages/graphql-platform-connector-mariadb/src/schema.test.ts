import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { IterableElement } from 'type-fest';
import { createMyGP, type MyGP } from './__tests__/config.js';
import { escapeIdentifier } from './escaping.js';
import { SchemaDiagnosis } from './schema.js';
import { StatementKind } from './statement.js';

describe('Schema', () => {
  const testIds = ['diagnosis'] as const;

  let gpsByTest: Record<IterableElement<typeof testIds>, MyGP>;

  beforeAll(
    () =>
      (gpsByTest = Object.fromEntries(
        Object.values(testIds).map((testId) => [
          testId,
          createMyGP(`connector_mariadb_schema_${testId}`),
        ]),
      ) as any),
  );

  afterAll(() =>
    Promise.all(Object.values(gpsByTest).map((gp) => gp.connector.teardown())),
  );

  it('diagnosis', async () => {
    const gp = gpsByTest.diagnosis;
    await gp.connector.teardown();

    await expect(gp.connector.schema.diagnose()).rejects.toThrowError(
      'The schema "tests_connector_mariadb_schema_diagnosis" is missing',
    );

    const extraTableQualifiedName = `${gp.connector.schema.name}.extra_table`;

    await gp.connector.withConnection(async (connection) => {
      await gp.connector.schema.create(undefined, connection);

      // Create an extra table
      await connection.query(`
        CREATE TABLE ${escapeIdentifier(extraTableQualifiedName)} (
          id INT UNSIGNED AUTO_INCREMENT NOT NULL,
          title VARCHAR(255) NOT NULL,
          PRIMARY KEY (id)
        )
      `);
    }, StatementKind.DATA_DEFINITION);

    // 1
    {
      const diagnosis = await gp.connector.schema.diagnose();
      expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
      expect(diagnosis.isValid()).toBeFalsy();
      expect(diagnosis.summarize()).toEqual({
        missingTables: [
          'articles',
          'categories',
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
        extraTables: ['extra_table'],
      });
    }

    // 2
    {
      await gp.connector.withConnection(
        (connection) =>
          Promise.all([
            ...['Article', 'Category'].map((nodeName) =>
              gp.connector.schema
                .getTableByNode(gp.getNodeByName(nodeName))
                .create({ withoutForeignKeys: true }, connection),
            ),
            connection.query(
              `DROP TABLE ${escapeIdentifier(extraTableQualifiedName)};`,
            ),
          ]),
        StatementKind.DATA_DEFINITION,
      );

      const diagnosis = await gp.connector.schema.diagnose();
      expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
      expect(diagnosis.isValid()).toBeFalsy();
      expect(diagnosis.summarize()).toEqual({
        missingTables: [
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
        invalidTables: {
          articles: {
            missingForeignKeys: [
              'fk_articles_category_private_id',
              'fk_articles_created_by_id',
              'fk_articles_updated_by_username',
            ],
          },
          categories: {
            missingForeignKeys: ['fk_categories_parent_private_id'],
          },
        },
      });
    }

    // 3
    {
      await gp.connector.withConnection(
        (connection) =>
          Promise.all(
            [
              'ArticleTag',
              'ArticleTagModeration',
              'Log',
              'Tag',
              'User',
              'UserProfile',
            ].map((nodeName) =>
              gp.connector.schema
                .getTableByNode(gp.getNodeByName(nodeName))
                .create({ withoutForeignKeys: true }, connection),
            ),
          ),
        StatementKind.DATA_DEFINITION,
      );

      const diagnosis = await gp.connector.schema.diagnose({});
      expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
      expect(diagnosis.isValid()).toBeFalsy();
      expect(diagnosis.summarize()).toEqual({
        invalidTables: {
          articles: {
            missingForeignKeys: [
              'fk_articles_category_private_id',
              'fk_articles_created_by_id',
              'fk_articles_updated_by_username',
            ],
          },
          categories: {
            missingForeignKeys: ['fk_categories_parent_private_id'],
          },
          article_tags: {
            missingForeignKeys: [
              'fk_article_tags_article_private_id',
              'fk_article_tags_tag_id',
            ],
          },
          article_tag_moderations: {
            missingForeignKeys: [
              'my_custom_fk_name',
              'fk_article_tag_moderations_moderator_id',
            ],
          },
          user_profiles: {
            missingForeignKeys: ['fk_user_profiles_theUserId'],
          },
        },
      });
    }

    // 4
    {
      await gp.connector.withConnection(
        (connection) =>
          Promise.all(
            [
              'Article',
              'ArticleTag',
              'ArticleTagModeration',
              'Category',
              'Log',
              'Tag',
              'User',
              'UserProfile',
            ].map((nodeName) =>
              gp.connector.schema
                .getTableByNode(gp.getNodeByName(nodeName))
                .addForeignKeys(undefined, connection),
            ),
          ),
        StatementKind.DATA_DEFINITION,
      );

      const diagnosis = await gp.connector.schema.diagnose();
      expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
      expect(diagnosis.isValid()).toBeTruthy();
      expect(diagnosis.summarize()).toEqual({});
    }
  });
});
