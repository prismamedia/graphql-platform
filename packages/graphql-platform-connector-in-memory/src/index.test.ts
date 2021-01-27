import { GraphQLPlatform } from '@prismamedia/graphql-platform';
import { InMemoryConnectorProvider } from '.';

describe('In-Memory connector', () => {
  it('typing works', () => {
    const gp = new GraphQLPlatform({
      models: {
        Article: {
          components: {
            id: {
              type: 'UUID',
              nullable: false,
              immutable: true,
            },
          },
          uniques: [['id']],
        },
      },
      connector: new InMemoryConnectorProvider(),
    });
  });
});
