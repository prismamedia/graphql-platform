import { ManagementKind, ResourceHookKind } from '@prismamedia/graphql-platform-core';
import { mergeWith } from '@prismamedia/graphql-platform-utils';
import { GraphQLInt } from 'graphql';
import { config as coreConfig, MyContext } from '../../../graphql-platform-core/src/__tests__/gp';
import { GraphQLPlatform, GraphQLPlatformConfig } from '../graphql-platform';
import { DataType, NumericDataTypeModifier } from '../graphql-platform/connector/database';
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
      onConnect: connection => connection.query('SET wait_timeout=1; SET max_statement_time=1;'),
    },

    default: resourceName => {
      const config = ((coreConfig.default ? coreConfig.default(resourceName) : {}) as unknown) as ResourceConfig;

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

          // This field is set in order to test current connection usage in hooks
          if (resourceName === 'Article') {
            mergeWith(fields, {
              computedMaxIntId: {
                description: 'An "auto-increment" kind of field',
                type: GraphQLInt,
                managed: ManagementKind.Full,
                hooks: {
                  [ResourceHookKind.PreCreate]: async event => {
                    const context = event.metas.context;
                    const connector = event.metas.context.connector;
                    const table = connector.getDatabase().getTable(event.metas.resource);
                    const field = table.getColumn(event.metas.resource.getFieldMap().assert('_id'));

                    // These 2 tests ensures the same connection is used everywhere in a mutation
                    const [uselessQueryToEnsureTheSameConnectionIsUsedInAPIBinding, results] = await Promise.all([
                      context.api.query.article(
                        {
                          where: {
                            category: { parent: null, slug: 'a-non-existent-category-slug' },
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
                      event.fieldValue = parseInt(results[0].maxIntId || 0, 10) + 100;
                    } else {
                      throw new Error(`An error occured.`);
                    }
                  },
                },
              } as FieldConfig<{}>,
            });

            (config.uniques || (config.uniques = [])).push('computedMaxIntId');
          }
        }

        if (fields.createdAt) {
          mergeWith(fields.createdAt, {
            column: {
              dataType: {
                type: DataType.TIMESTAMP,
                microsecondPrecision: 3,
              },
              default: 'CURRENT_TIMESTAMP',
            },
          });
        }

        if (fields.updatedAt) {
          mergeWith(fields.updatedAt, {
            column: {
              dataType: {
                type: DataType.TIMESTAMP,
                microsecondPrecision: 3,
              },
              default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            },
          });
        }
      }

      return config;
    },
  } as Partial<MyGPConfig>,
);

export const gp = new MyGP(config);
