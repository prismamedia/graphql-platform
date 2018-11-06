import { MyContext } from '@prismamedia/graphql-platform-core/src/__tests__';
import { GraphQLBoolean, GraphQLInt, GraphQLNonNull, printSchema, validateSchema } from 'graphql';
import { GraphQLPlatform, GraphQLPlatformConfig } from '../graphql-platform';

const config: GraphQLPlatformConfig<MyContext> = {
  context: () => ({
    myService: true,
  }),

  resources: {
    MyConnectedArticle: {
      uniques: ['myId'],

      fields: {
        myId: {
          type: GraphQLInt,
        },
      },

      virtualFields: {
        myConnectedVirtualField: {
          type: GraphQLNonNull(GraphQLBoolean),
          resolve: (_, args, { myService }) => myService,
        },
      },
    },
  },

  queries: {
    myConnectedCustomQuery: {
      type: GraphQLNonNull(GraphQLBoolean),
      resolve: (_, args, { myService, connectorRequest }) =>
        connectorRequest.withConnection(async () => true) && myService,
    },
  },
};

const graphqlPlatform = new GraphQLPlatform(config);

describe('One file configuration', () => {
  const schema = graphqlPlatform.getGraphQLSchema();

  it('creates a valid GraphQL schema', () => {
    expect(validateSchema(schema)).toHaveLength(0);
  });

  it('creates a consistent GraphQL schema', () => {
    expect(printSchema(schema, { commentDescriptions: true })).toMatchSnapshot();
  });
});
