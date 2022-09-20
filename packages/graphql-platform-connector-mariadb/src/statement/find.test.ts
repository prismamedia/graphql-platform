import {
  ComponentConfig,
  GraphQLPlatform,
  NodeConfig,
} from '@prismamedia/graphql-platform';
import {
  MyContext,
  MyGP,
  myUserContext,
  nodes,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import * as rxjs from 'rxjs';
import { MariaDBConnector } from '../index.js';
import { FindStatement } from './find.js';

describe('Find statement', () => {
  let gp: MyGP<MariaDBConnector>;

  beforeAll(async () => {
    gp = new GraphQLPlatform<MyContext, MariaDBConnector>({
      nodes: Object.fromEntries<NodeConfig>(
        Object.entries(nodes).map<[string, NodeConfig]>(
          ([nodeName, config]) => [
            nodeName,
            {
              ...config,
              components: Object.fromEntries<ComponentConfig>(
                Object.entries(config.components).map<
                  [string, ComponentConfig]
                >(([componentName, config]) => [
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
                ]),
              ),
            },
          ],
        ),
      ),
      connector: [
        MariaDBConnector,
        {
          schema: {
            name: 'test_find',
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

    await gp.connector.reset();
  });

  afterAll(async () => {
    try {
      await gp.connector.schema.drop({ ifExists: true });
    } finally {
      await gp.connector.pool.end();
    }
  });

  it('generates valid select statements', async () => {
    const statements: FindStatement['sql'][] = [];

    const subscriber = gp.connector.executedStatements
      .pipe(
        rxjs.filter(
          ({ statement }) =>
            statement instanceof FindStatement &&
            statement.table.name === 'articles',
        ),
      )
      .subscribe(({ statement }) => {
        statements.push(statement.sql);
      });

    try {
      await expect(
        gp.api.query.articles(
          {
            where: {},
            orderBy: ['createdAt_DESC'],
            first: 5,
            selection: `{ 
            title 
            category {
              title 
            }
            tags(first: 5) {
              tag {
                title
              }
            }
          }`,
          },
          myUserContext,
        ),
      ).resolves.toEqual([]);
    } finally {
      subscriber.unsubscribe();
    }

    expect(statements).toEqual([
      `SELECT \`articles\`.*
FROM \`test_find\`.\`articles\` AS \`articles\`
  LEFT JOIN \`test_find\`.\`categories\` AS \`articles>categories\` ON \`articles\`.\`category_privateId\` = \`articles>categories\`.\`privateId\`
    LEFT JOIN \`test_find\`.\`categories\` AS \`articles>categories>categories\` ON \`articles>categories\`.\`parent_privateId\` = \`articles>categories>categories\`.\`privateId\`
      LEFT JOIN \`test_find\`.\`categories\` AS \`articles>categories>categories>categories\` ON \`articles>categories>categories\`.\`parent_privateId\` = \`articles>categories>categories>categories\`.\`privateId\`
  LEFT JOIN \`test_find\`.\`users\` AS \`articles>users\` ON \`articles\`.\`created_by_id\` = \`articles>users\`.\`id\`
  LEFT JOIN \`test_find\`.\`article_tags\` AS \`articles>article_tags\` ON \`articles\`.\`privateId\` = \`articles>article_tags\`.\`article_privateId\``,
    ]);
  });
});
