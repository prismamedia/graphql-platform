import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
  printSchema,
  validateSchema,
} from 'graphql';
import { MyGP } from './gp';

describe('One file configuration', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new MyGP({
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
    });
  });

  it('creates a valid GraphQL schema', () => {
    const schema = gp.getGraphQLSchema();

    expect(validateSchema(schema)).toHaveLength(0);
    expect(
      printSchema(schema, { commentDescriptions: true }),
    ).toMatchSnapshot();
  });
});
