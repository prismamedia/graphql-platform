import { GraphQLBoolean, GraphQLInt, GraphQLNonNull, GraphQLString, printSchema, validateSchema } from 'graphql';
import { MyContext } from '.';
import { GraphQLPlatform, GraphQLPlatformConfig } from '../graphql-platform';

const config: GraphQLPlatformConfig<any, MyContext> = {
  context: () => ({
    myService: true,
  }),

  resources: {
    MyArticle: {
      uniques: ['myId'],

      fields: {
        myId: {
          type: GraphQLInt,
        },
        myTitle: {
          type: GraphQLString,
        },
      },

      virtualFields: {
        myVirtualField: {
          type: GraphQLNonNull(GraphQLBoolean),
          resolve: (_, args, { myService }) => myService,
        },
      },
    },
  },

  queries: {
    myCustomQuery: {
      type: GraphQLNonNull(GraphQLBoolean),
      resolve: (_, args, { myService }) => myService,
    },
  },
};

const graphqlPlatform = new GraphQLPlatform(config);

describe('One file configuration', () => {
  const schema = graphqlPlatform.getGraphQLSchema();

  it('creates a valid GraphQL schema', () => {
    expect(validateSchema(schema)).toHaveLength(0);
  });

  it('creates a GraphQL schema', () => {
    expect(printSchema(schema, { commentDescriptions: true })).toMatchSnapshot();
  });
});
