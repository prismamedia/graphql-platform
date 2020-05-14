import {
  ManagementKind,
  ResourceHookKind,
} from '@prismamedia/graphql-platform-core';
import {
  config as coreConfig,
  MyContext,
} from '@prismamedia/graphql-platform-core/src/__tests__/gp';
import { mergeWith } from '@prismamedia/graphql-platform-utils';
import { GraphQLInt } from 'graphql';
import { GraphQLDateTime } from 'graphql-iso-date';
import { GraphQLPlatform, GraphQLPlatformConfig } from '../graphql-platform';
import {
  DataType,
  NumericDataTypeModifier,
} from '../graphql-platform/connector/database';
import { FieldConfig, ResourceConfig } from '../graphql-platform/resource';

export type MyGPConfig = GraphQLPlatformConfig<any, MyContext>;

export class MyGP extends GraphQLPlatform<{}, MyContext> {}

function assertEnv(key: string): string {
  const value = process.env[key];
  if (typeof value !== 'string') {
    throw new Error(`The environment variable "${key}" is not defined.`);
  }

  return value;
}

export const config: MyGPConfig = mergeWith(
  {},
  coreConfig as any,
  {
    connector: {
      host: assertEnv('MARIADB_HOST'),
      port: parseInt(assertEnv('MARIADB_PORT')),
      user: assertEnv('MARIADB_USER'),
      password: assertEnv('MARIADB_PASSWORD'),
      database: assertEnv('MARIADB_DATABASE'),

      connectionLimit: 1,
      onConnect: (connection) =>
        connection.query('SET wait_timeout=1, max_statement_time=1;'),

      migrations: `${__dirname}/migrations`,
    },

    default: (resourceName) => {
      const config = ((coreConfig.default
        ? coreConfig.default(resourceName)
        : {}) as unknown) as ResourceConfig;

      const fields = config.fields;

      if (fields && !(fields instanceof Map || typeof fields === 'string')) {
        if ('_id' in fields && fields._id) {
          mergeWith(fields._id, {
            column: {
              name: 'intId',
              dataType: {
                type: DataType.INTEGER,
                modifiers: [NumericDataTypeModifier.UNSIGNED],
              },
              autoIncrement: true,
            },
          });

          if (resourceName === 'Article') {
            mergeWith(config, { table: { findPrimaryKeyFirst: true } });

            // This field is set in order to test current connection usage in hooks
            mergeWith(fields, {
              computedMaxIntId: {
                description: 'An "auto-increment" kind of field',
                type: GraphQLInt,
                managed: ManagementKind.Full,
                hooks: {
                  [ResourceHookKind.PreCreate]: async (event) => {
                    const context = event.metas.context;
                    const connector = event.metas.context.connector;
                    const table = connector
                      .getDatabase()
                      .getTable(event.metas.resource);
                    const field = table.getColumn(
                      event.metas.resource.getFieldMap().assert('_id'),
                    );

                    // These 2 tests ensures the same connection is used everywhere in a mutation
                    const [
                      uselessQueryToEnsureTheSameConnectionIsUsedInAPIBinding,
                      results,
                    ] = await Promise.all([
                      context.api.query.article(
                        {
                          where: {
                            category: {
                              parent: null,
                              slug: 'a-non-existent-category-slug',
                            },
                            slug: 'a-non-existent-article-slug',
                          },
                        },
                        '{ slug }',
                        { context },
                      ),
                      connector.query(
                        `SELECT MAX(${field.getEscapedName()}) as maxIntId FROM ${table.getEscapedName()};`,
                        context,
                      ),
                    ]);

                    if (Array.isArray(results) && results.length === 1) {
                      // The "|| 0" is usefull for empty databse
                      event.fieldValue =
                        parseInt(results[0].maxIntId || 0, 10) + 100;
                    } else {
                      throw new Error(`An error occured.`);
                    }
                  },
                },
              } as FieldConfig<{}>,
              publishedAt: {
                column: {
                  dataType: {
                    type: DataType.TIMESTAMP,
                    microsecondPrecision: 3,
                  },
                },
              } as FieldConfig<{}>,
            });

            (config.uniques || (config.uniques = [])).push('computedMaxIntId');
          }
        }

        for (const [name, field] of Object.entries(fields)) {
          if (field.type === GraphQLDateTime) {
            mergeWith(field, {
              column: {
                dataType: {
                  type: DataType.TIMESTAMP,
                  microsecondPrecision: 3,
                },
              },
            });

            if (name === 'createdAt') {
              mergeWith(field, {
                column: {
                  default: 'NOW(3)',
                },
              });

              mergeWith(config, {
                table: <ResourceConfig['table']>{
                  indexes: [['createdAt']],
                },
              });
            } else if (name === 'updatedAt') {
              mergeWith(field, {
                column: {
                  default: 'NOW(3) ON UPDATE NOW(3)',
                },
              });

              mergeWith(config, {
                table: <ResourceConfig['table']>{
                  indexes: [
                    {
                      name: 'ids_my_custom_name_for_updatedAt',
                      components: ['updatedAt'],
                    },
                  ],
                },
              });
            }
          }
        }
      }

      return config;
    },
  } as Partial<MyGPConfig>,
);
