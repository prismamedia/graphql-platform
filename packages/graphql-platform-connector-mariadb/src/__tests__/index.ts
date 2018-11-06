import { mergeWith } from '@prismamedia/graphql-platform-utils';
import { config as coreConfig, MyContext } from '../../../graphql-platform-core/src/__tests__';
import { GraphQLPlatform, GraphQLPlatformConfig } from '../graphql-platform';
import { DataType, NumericDataTypeModifier } from '../graphql-platform/connector/database';
import { ResourceConfig } from '../graphql-platform/resource';

function assertEnv(key: string): string {
  const value = process.env[key];
  if (typeof value !== 'string') {
    throw new Error(`The environment variable "${key}" is not defined.`);
  }

  return value;
}

export const config: GraphQLPlatformConfig<any, MyContext> = {
  connector: {
    host: assertEnv('MARIADB_HOST'),
    port: parseInt(assertEnv('MARIADB_PORT')),
    user: assertEnv('MARIADB_USER'),
    password: assertEnv('MARIADB_PASSWORD'),
    database: assertEnv('MARIADB_DATABASE'),

    connectionLimit: 1,
    onConnect: connection => connection.query('SET wait_timeout=1; SET max_statement_time=1;'),
  },

  context: coreConfig.context,

  default: resourceName => {
    const config = ((coreConfig.default ? coreConfig.default(resourceName) : {}) as unknown) as ResourceConfig;
    const fields = config.fields;

    if (!(fields instanceof Map || typeof fields === 'string')) {
      if (fields._id) {
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

  resources: `${__dirname}/../../../graphql-platform-core/src/__tests__/resources`,

  mutations: `${__dirname}/../../../graphql-platform-core/src/__tests__/mutations`,

  queries: `${__dirname}/../../../graphql-platform-core/src/__tests__/queries`,
};

export const graphqlPlatform = new GraphQLPlatform(config);
