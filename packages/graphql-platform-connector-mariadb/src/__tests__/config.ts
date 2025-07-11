import type * as core from '@prismamedia/graphql-platform';
import type * as utils from '@prismamedia/graphql-platform-utils';
import {
  createMyGP as baseCreateMyGP,
  slugify,
  type MyGP as BaseMyGP,
  type MyGPConfig as BaseMyGPConfig,
  type MyContext,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import type { Except } from 'type-fest';
import type { MariaDBBroker } from '../broker.js';
import { MariaDBConnector } from '../index.js';

export const truncateSchemaNameIfNeeded = (schemaName: string): string =>
  schemaName.length > 64
    ? // (-7) for the hash and (-1) for the underscore
      `${schemaName.slice(0, 64 - 7 - 1)}_${createHash('sha256').update(schemaName).digest('hex').slice(0, 7)}`
    : schemaName;

export type MyGPConfig<TContainer extends object> = Except<
  BaseMyGPConfig<MariaDBConnector, MariaDBBroker, TContainer>,
  'overrides' | 'connector'
>;

export type MyGP<TContainer extends object = any> = BaseMyGP<
  MariaDBConnector,
  MariaDBBroker,
  TContainer
>;

export function createMyConnector(
  testName: string,
  gp: core.GraphQLPlatform<MyContext, MariaDBConnector>,
  configPath: utils.Path,
) {
  const host = process.env.MARIADB_HOST;
  assert(host, `The "MARIADB_HOST" variable must be provided`);

  const port = process.env.MARIADB_PORT
    ? Number.parseInt(process.env.MARIADB_PORT)
    : undefined;
  assert(port, `The "MARIADB_PORT" variable must be provided`);

  const password = process.env.MARIADB_ROOT_PASSWORD;
  assert(password, `The "MARIADB_ROOT_PASSWORD" variable must be provided`);

  const schemaName = slugify(`tests_${testName}`, '_');

  return new MariaDBConnector(
    gp,
    {
      version: '11.4',

      useCommonTableExpression: true,

      schema: {
        name: truncateSchemaNameIfNeeded(schemaName),

        namingStrategy: {
          leaf: (column) =>
            column.leaf.name === '_id' ? 'private_id' : undefined,
        },
      },

      pool: {
        host,
        port,
        user: 'root',
        password,
      },

      broker: {
        heartbeatInterval: 5,
        retention: 15,
      },
    },
    configPath,
  );
}

export function createMyGP<TContainer extends object>(
  testName: string,
  config?: MyGPConfig<TContainer>,
): MyGP<TContainer> {
  return baseCreateMyGP({
    overrides: {
      node: (node) =>
        node === 'Article'
          ? {
              table: {
                indexes: [
                  ['slug'],
                  ['status', 'slug'],
                  ['category', 'updatedAt'],
                ],

                subscriptionsState: true,
              },
            }
          : undefined,

      leaf: (leaf, node) =>
        leaf === '_id'
          ? { column: { autoIncrement: true } }
          : node === 'Article' && leaf === 'title'
            ? {
                column: {
                  fullTextIndex: true,
                },
              }
            : node === 'Article' && leaf === 'updatedAt'
              ? {
                  column: {
                    dataType: { kind: 'TIMESTAMP', microsecondPrecision: 0 },
                  },
                }
              : node === 'Category' && leaf === 'order'
                ? {
                    column: {
                      dataType: {
                        kind: 'INT',
                        length: 3,
                        modifiers: ['UNSIGNED'],
                      },
                    },
                  }
                : node === 'User' && leaf === 'lastLoggedInAt'
                  ? {
                      column: {
                        dataType: {
                          kind: 'TIMESTAMP',
                          microsecondPrecision: 0,
                        },
                      },
                    }
                  : undefined,

      edge: (edge, node) =>
        node === 'UserProfile' && edge === 'user'
          ? { columns: { id: 'theUserId' } }
          : node === 'ArticleTagModeration' && edge === 'articleTag'
            ? {
                columns: {
                  article: { _id: 'theArticlePrivateId' },
                  tag: { id: 'theTagId' },
                },
                foreignKey: { name: 'my_custom_fk_name' },
              }
            : undefined,
    },

    connector: (gp, configPath) => createMyConnector(testName, gp, configPath),

    ...config,
  });
}
