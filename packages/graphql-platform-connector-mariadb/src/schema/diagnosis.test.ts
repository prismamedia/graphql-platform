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

    const connector = gp.connector;
    const schema = connector.schema;

    await expect(schema.diagnose()).rejects.toThrow(
      `The schema "${schema}" is missing`,
    );

    const extraTableQualifiedName = `${schema}.extra_table`;

    const CategoryNode = gp.getNodeByName('Category');
    const CategoryTable = schema.getTableByNode(CategoryNode);

    await connector.withConnection(async (connection) => {
      // await schema.create(undefined, connection);
      await connection.query(
        `CREATE SCHEMA ${escapeIdentifier(
          schema.name,
        )} COMMENT = 'Wrong schema comment'`,
      );

      // Create an extra table
      await connection.query(`
        CREATE TABLE ${escapeIdentifier(extraTableQualifiedName)} (
          id INT UNSIGNED AUTO_INCREMENT NOT NULL,
          title VARCHAR(255) NOT NULL,
          PRIMARY KEY (id)
        )
      `);

      // Create an invalid table
      await connection.query(`
        CREATE TABLE ${escapeIdentifier(CategoryTable.qualifiedName)} (${[
          `extra_id INT UNSIGNED AUTO_INCREMENT NOT NULL PRIMARY KEY`,
          `private_id INT NOT NULL`,
          `parent_private_id INT NULL`,
          `id UUID NOT NULL`,
          `UNIQUE unq_id (id)`,
          `slug VARCHAR(50) NULL`,
          `INDEX extra_idx_slug (slug)`,
          `INDEX idx_private_id (private_id)`,
          `extra_column VARCHAR(255) NOT NULL`,
          `FOREIGN KEY fk_categories_parent_private_id (parent_private_id) REFERENCES categories (private_id) ON UPDATE RESTRICT ON DELETE RESTRICT`,
        ].join(`,${EOL}`)})
        COMMENT = ${escapeStringValue('Wrong table comment')}
        DEFAULT CHARSET ${escapeStringValue(CategoryTable.defaultCharset)}
        DEFAULT COLLATE ${escapeStringValue(CategoryTable.defaultCollation)}
      `);
    }, StatementKind.DATA_DEFINITION);

    let diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 89,

      collation: {
        actual: 'utf8mb4_general_ci',
        expected: 'utf8mb4_unicode_520_ci',
      },
      comment: {
        actual: 'Wrong schema comment',
        expected: undefined,
      },
      tables: {
        extra: ['extra_table'],
        missing: [
          'articles',
          'article_extensions',
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
        invalid: {
          categories: {
            comment: { actual: 'Wrong table comment', expected: undefined },
            foreignKeys: {
              invalid: {
                fk_categories_parent_private_id: {
                  referencedUniqueIndex: {
                    actual: 'idx_private_id',
                    expected: 'PRIMARY',
                  },
                },
              },
            },
            indexes: {
              extra: ['extra_idx_slug', 'idx_private_id'],
              invalid: {
                PRIMARY: {
                  columns: {
                    actual: ['extra_id'],
                    expected: ['private_id'],
                  },
                },
              },
              missing: [
                'unq_parent_private_id_slug',
                'unq_parent_private_id_order',
              ],
            },
            columns: {
              extra: ['extra_id', 'extra_column'],
              missing: ['title', 'order'],
              invalid: {
                private_id: {
                  autoIncrement: {
                    actual: '',
                    expected: true,
                  },
                  dataType: {
                    actual: {
                      DATA_TYPE: 'int',
                      NUMERIC_PRECISION: 10n,
                      NUMERIC_SCALE: 0n,
                    },
                    expected: 'INT UNSIGNED',
                  },
                },
                parent_private_id: {
                  dataType: {
                    actual: {
                      DATA_TYPE: 'int',
                      NUMERIC_PRECISION: 10n,
                      NUMERIC_SCALE: 0n,
                    },
                    expected: 'INT UNSIGNED',
                  },
                },
                slug: {
                  dataType: {
                    actual: {
                      CHARACTER_MAXIMUM_LENGTH: 50n,
                      CHARACTER_OCTET_LENGTH: 200n,
                      DATA_TYPE: 'varchar',
                    },
                    expected: 'VARCHAR(255)',
                  },
                  nullable: { actual: 'YES', expected: false },
                },
              },
            },
          },
        },
      },
    });

    await diagnosis.fix({ tables: false });

    diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 87,

      tables: {
        extra: ['extra_table'],
        missing: [
          'articles',
          'article_extensions',
          'tags',
          'article_tags',
          'article_tag_moderations',
          'users',
          'user_profiles',
          'logs',
        ],
        invalid: {
          categories: {
            comment: { actual: 'Wrong table comment', expected: undefined },
            foreignKeys: {
              invalid: {
                fk_categories_parent_private_id: {
                  referencedUniqueIndex: {
                    actual: 'idx_private_id',
                    expected: 'PRIMARY',
                  },
                },
              },
            },
            indexes: {
              extra: ['extra_idx_slug', 'idx_private_id'],
              invalid: {
                PRIMARY: {
                  columns: {
                    actual: ['extra_id'],
                    expected: ['private_id'],
                  },
                },
              },
              missing: [
                'unq_parent_private_id_slug',
                'unq_parent_private_id_order',
              ],
            },
            columns: {
              extra: ['extra_id', 'extra_column'],
              missing: ['title', 'order'],
              invalid: {
                private_id: {
                  autoIncrement: {
                    actual: '',
                    expected: true,
                  },
                  dataType: {
                    actual: {
                      DATA_TYPE: 'int',
                      NUMERIC_PRECISION: 10n,
                      NUMERIC_SCALE: 0n,
                    },
                    expected: 'INT UNSIGNED',
                  },
                },
                parent_private_id: {
                  dataType: {
                    actual: {
                      DATA_TYPE: 'int',
                      NUMERIC_PRECISION: 10n,
                      NUMERIC_SCALE: 0n,
                    },
                    expected: 'INT UNSIGNED',
                  },
                },
                slug: {
                  dataType: {
                    actual: {
                      CHARACTER_MAXIMUM_LENGTH: 50n,
                      CHARACTER_OCTET_LENGTH: 200n,
                      DATA_TYPE: 'varchar',
                    },
                    expected: 'VARCHAR(255)',
                  },
                  nullable: { actual: 'YES', expected: false },
                },
              },
            },
          },
        },
      },
    });

    await diagnosis.fix({
      tables: ['extra_table', 'articles', 'article_extensions', 'categories'],
    });

    diagnosis = await schema.diagnose();

    expect(diagnosis).toBeInstanceOf(SchemaDiagnosis);
    expect(diagnosis.isValid()).toBeFalsy();
    expect(diagnosis.summarize()).toEqual({
      errors: 41,

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
                'fk_articles_created_by_id',
                'fk_articles_updated_by_username',
              ],
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
