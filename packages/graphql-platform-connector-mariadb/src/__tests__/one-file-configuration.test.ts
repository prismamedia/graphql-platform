import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLSchema,
  printSchema,
  validateSchema,
} from 'graphql';
import { MyGP } from './gp';

describe('One file configuration', () => {
  let gp: MyGP;
  let schema: GraphQLSchema;

  beforeAll(() => {
    gp = new MyGP({
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
          resolve: (_, args, { myService, connector }) => true,
        },
      },
    });

    schema = gp.getGraphQLSchema();
  });

  it('creates a valid GraphQL schema', () => {
    expect(validateSchema(schema)).toHaveLength(0);
  });

  it('creates a consistent GraphQL schema', () => {
    expect(
      printSchema(schema, { commentDescriptions: true }),
    ).toMatchSnapshot();
  });
});
