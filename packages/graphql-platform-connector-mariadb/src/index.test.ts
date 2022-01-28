import {
  ComponentConfig,
  GraphQLPlatform,
  NodeConfig,
} from '@prismamedia/graphql-platform';
import {
  myAdminContext,
  MyContext,
  MyGP,
  nodes,
} from '@prismamedia/graphql-platform/__tests__/config.js';
import { fixtures } from '@prismamedia/graphql-platform/__tests__/fixture.js';
import { EOL } from 'node:os';
import { MariaDBConnector } from './index.js';

describe('GraphQL Platform Connector MariaDB', () => {
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
            name: 'test',
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

  it('generates valid and stable schema & statements', async () => {
    const schema = gp.connector.schema;

    expect(
      schema.makeDropStatement({ ifExists: true }).statement,
    ).toMatchSnapshot();

    expect(
      schema.makeCreateStatement({ orReplace: true }).statement,
    ).toMatchSnapshot();

    expect(
      Array.from(
        schema.tablesByNode.values(),
        (table) => table.makeCreateStatement().statement,
      ).join(EOL.repeat(2)),
    ).toMatchSnapshot();

    expect(
      Array.from(schema.tablesByNode.values(), (table) =>
        table.foreignKeysByEdge.size
          ? table.makeAddForeignKeysStatement().statement
          : undefined,
      )
        .filter(Boolean)
        .join(EOL.repeat(2)),
    ).toMatchSnapshot();
  });

  it('loads the fixtures', async () => {
    await gp.seed(fixtures, myAdminContext, false);
  });
});
