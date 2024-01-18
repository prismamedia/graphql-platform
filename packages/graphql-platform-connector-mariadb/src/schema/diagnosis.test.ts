import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { EOL } from 'node:os';
import { createMyGP, type MyGP } from '../__tests__/config.js';
import { escapeIdentifier, escapeStringValue } from '../escaping.js';
import { SchemaDiagnosis } from '../schema.js';
import { StatementKind } from '../statement.js';

describe('SchemaDiagnosis', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = createMyGP(`connector_mariadb_schema_diagnosis`);
  });

  afterAll(() => gp.connector.teardown());

  it('diagnosis', async () => {
    gp.connector.on('failed-statement', ({ statement, error }) =>
      console.error(statement.sql, error.message),
    );

    const schema = gp.connector.schema;

    await expect(schema.diagnose()).rejects.toThrow(
      `The schema "${schema}" is missing`,
    );

    const extraTableQualifiedName = `${schema.name}.extra_table`;

    await gp.connector.withConnection(async (connection) => {
      // await schema.create(undefined, connection);
      await connection.query(
        `CREATE SCHEMA ${escapeIdentifier(
          schema.name,
        )} COMMENT = 'Wrong comment'`,
      );

      // Create an extra table
      await connection.query(`
        CREATE TABLE ${escapeIdentifier(extraTableQualifiedName)} (
          id INT UNSIGNED AUTO_INCREMENT NOT NULL,
          title VARCHAR(255) NOT NULL,
          PRIMARY KEY (id)
        )
      `);
    }, StatementKind.DATA_DEFINITION);

    let diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 84,

      collation: {
        actual: 'utf8mb4_general_ci',
        expected: 'utf8mb4_unicode_520_ci',
      },
      comment: {
        actual: 'Wrong comment',
        expected: undefined,
      },
      tables: {
        extra: ['extra_table'],
        missing: [
          'articles',
          'article_extensions',
          'categories',
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
      },
    });

    await diagnosis.fix({ tables: false });

    diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 82,
      tables: {
        extra: ['extra_table'],
        missing: [
          'articles',
          'article_extensions',
          'categories',
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
      },
    });

    await diagnosis.fix({
      foreignKeys: false,

      tables: ['extra_table', 'articles', 'article_extensions', 'categories'],
    });

    diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 44,

      tables: {
        missing: [
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
        invalid: {
          articles: {
            foreignKeys: {
              missing: [
                'fk_articles_category_private_id',
                'fk_articles_created_by_id',
                'fk_articles_updated_by_username',
              ],
            },
          },
          article_extensions: {
            foreignKeys: {
              missing: ['fk_article_extensions_article_private_id'],
            },
          },
          categories: {
            foreignKeys: {
              missing: ['fk_categories_parent_private_id'],
            },
          },
        },
      },
    });

    const CategoryNode = gp.getNodeByName('Category');
    const CategoryTable = schema.getTableByNode(CategoryNode);

    await gp.connector.executeQuery(
      [
        `ALTER TABLE ${escapeIdentifier(CategoryTable.qualifiedName)}`,
        [
          `COMMENT = ${escapeStringValue('Wrong comment')}`,
          `DROP COLUMN title`,
          `MODIFY COLUMN slug VARCHAR(50) NULL`,
          `ADD COLUMN extra_column VARCHAR(255) NOT NULL`,
          `ADD INDEX extra_idx_slug (slug)`,
          `ADD FOREIGN KEY extra_fk_categories_parent_private_id (parent_private_id) REFERENCES categories (private_id) ON DELETE RESTRICT ON UPDATE RESTRICT`,
          `ADD FOREIGN KEY fk_categories_parent_private_id (parent_private_id) REFERENCES categories (private_id) ON DELETE CASCADE ON UPDATE CASCADE`,
        ].join(`,${EOL}`),
      ].join(EOL),
      StatementKind.DATA_DEFINITION,
    );

    diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 52,

      tables: {
        missing: [
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
        invalid: {
          articles: {
            foreignKeys: {
              missing: [
                'fk_articles_category_private_id',
                'fk_articles_created_by_id',
                'fk_articles_updated_by_username',
              ],
            },
          },
          article_extensions: {
            foreignKeys: {
              missing: ['fk_article_extensions_article_private_id'],
            },
          },
          categories: {
            comment: {
              actual: 'Wrong comment',
              expected: undefined,
            },

            columns: {
              extra: ['extra_column'],
              missing: ['title'],
              invalid: {
                slug: {
                  dataType: {
                    expected: 'VARCHAR(255)',
                    actual: {
                      DATA_TYPE: 'varchar',
                      CHARACTER_MAXIMUM_LENGTH: 50n,
                      CHARACTER_OCTET_LENGTH: 200n,
                    },
                  },
                  nullable: {
                    actual: 'YES',
                    expected: false,
                  },
                },
              },
            },

            indexes: {
              extra: ['extra_idx_slug'],
            },

            foreignKeys: {
              extra: ['extra_fk_categories_parent_private_id'],
              invalid: {
                fk_categories_parent_private_id: {
                  onDelete: {
                    actual: 'CASCADE',
                    expected: 'RESTRICT',
                  },
                  onUpdate: {
                    actual: 'CASCADE',
                    expected: 'RESTRICT',
                  },
                },
              },
            },
          },
        },
      },
    });

    await diagnosis.fix({ foreignKeys: false });

    diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 12,

      tables: {
        invalid: {
          articles: {
            foreignKeys: {
              missing: [
                'fk_articles_category_private_id',
                'fk_articles_created_by_id',
                'fk_articles_updated_by_username',
              ],
            },
          },
          article_extensions: {
            foreignKeys: {
              missing: ['fk_article_extensions_article_private_id'],
            },
          },
          article_tag_moderations: {
            foreignKeys: {
              missing: [
                'my_custom_fk_name',
                'fk_article_tag_moderations_moderator_id',
              ],
            },
          },
          article_tags: {
            foreignKeys: {
              missing: [
                'fk_article_tags_article_private_id',
                'fk_article_tags_tag_id',
              ],
            },
          },
          categories: {
            foreignKeys: {
              extra: ['extra_fk_categories_parent_private_id'],
              invalid: {
                fk_categories_parent_private_id: {
                  onDelete: {
                    actual: 'CASCADE',
                    expected: 'RESTRICT',
                  },
                  onUpdate: {
                    actual: 'CASCADE',
                    expected: 'RESTRICT',
                  },
                },
              },
            },
          },
          user_profiles: {
            foreignKeys: {
              missing: ['fk_user_profiles_theUserId'],
            },
          },
        },
      },
    });

    await diagnosis.fix();

    diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeTruthy();
  });
});
