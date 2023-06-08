import type { ContainerConfig } from '@prismamedia/graphql-platform';
import {
  MyContext,
  createMyGP as baseCreateMyGP,
  type MyGP as BaseMyGP,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import assert from 'node:assert/strict';
import { MariaDBConnector } from '../index.js';

export type MyGP<TContainer extends object = any> = BaseMyGP<
  MariaDBConnector,
  TContainer
>;

export function createMyGP<TContainer extends object>(
  schemaName: string,
  config?: {
    container?: ContainerConfig<MyContext, MariaDBConnector, TContainer>;
  },
): MyGP<TContainer> {
  const host = process.env.MARIADB_HOST;
  assert(host, `The "MARIADB_HOST" variable must be provided`);

  const port = process.env.MARIADB_PORT
    ? Number.parseInt(process.env.MARIADB_PORT)
    : undefined;
  assert(port, `The "MARIADB_PORT" variable must be provided`);

  const password = process.env.MARIADB_ROOT_PASSWORD;
  assert(password, `The "MARIADB_ROOT_PASSWORD" variable must be provided`);

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
              },
            }
          : undefined,

      leaf: (leaf, node) =>
        leaf === '_id'
          ? { column: { autoIncrement: true } }
          : node === 'Article' && leaf === 'title'
          ? { column: { fullTextIndex: true } }
          : node === 'Article' && leaf === 'updatedAt'
          ? {
              column: {
                dataType: { kind: 'TIMESTAMP', microsecondPrecision: 0 },
              },
            }
          : node === 'User' && leaf === 'lastLoggedInAt'
          ? {
              column: {
                dataType: { kind: 'TIMESTAMP', microsecondPrecision: 0 },
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

    connector: (gp, configPath) =>
      new MariaDBConnector(
        gp,
        {
          schema: {
            name: `tests_${schemaName}`,

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
        },
        configPath,
      ),

    container: config?.container,
  });
}
