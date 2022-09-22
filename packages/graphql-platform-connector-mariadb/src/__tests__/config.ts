import {
  ComponentConfig,
  GraphQLPlatform,
  NodeConfig,
} from '@prismamedia/graphql-platform';
import {
  MyContext,
  nodes,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { MariaDBConnector } from '../index.js';

export function makeGraphQLPlatform(
  schemaName: string,
): GraphQLPlatform<MyContext, MariaDBConnector> {
  return new GraphQLPlatform<MyContext, MariaDBConnector>({
    nodes: Object.fromEntries<NodeConfig>(
      Object.entries(nodes).map<[string, NodeConfig]>(([nodeName, config]) => [
        nodeName,
        {
          ...config,
          components: Object.fromEntries<ComponentConfig>(
            Object.entries(config.components).map<[string, ComponentConfig]>(
              ([componentName, config]) => [
                componentName,
                componentName === '_id' &&
                config.kind === 'Leaf' &&
                (config.type === 'Int' || config.type === 'UnsignedInt')
                  ? {
                      ...config,
                      column: { name: 'privateId', autoIncrement: true },
                    }
                  : nodeName === 'UserProfile' &&
                    componentName === 'user' &&
                    config.kind === 'Edge'
                  ? {
                      ...config,
                      columns: { id: 'theUserId' },
                    }
                  : nodeName === 'ArticleTagModeration' &&
                    componentName === 'articleTag' &&
                    config.kind === 'Edge'
                  ? {
                      ...config,
                      columns: {
                        article: { _id: 'theArticlePrivateId' },
                        tag: { id: 'theTagId' },
                      },
                      foreignKey: { name: 'my_custom_fk_name' },
                    }
                  : config,
              ],
            ),
          ),
        },
      ]),
    ),
    connector: [
      MariaDBConnector,
      {
        schema: {
          name: `tests_${schemaName}`,
        },
        pool: {
          host: 'mariadb',
          user: 'root',
          password: 'test',
          idleTimeout: 30,
        },
      },
    ],
  });
}
