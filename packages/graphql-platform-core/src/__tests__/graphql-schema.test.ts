import { GraphQLID, printSchema, validateSchema } from 'graphql';
import { GraphQLPlatform } from '..';
import { config, MyGP } from './gp';

describe('GraphQLSchema', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new MyGP(config);
  });

  it('creates a consistent valid GraphQL schema', () => {
    const schema = gp.getGraphQLSchema();

    expect(validateSchema(schema)).toHaveLength(0);
    expect(
      printSchema(schema, { commentDescriptions: true }),
    ).toMatchSnapshot();
  });

  it('creates a valid GraphQL schema with resource and without mutations', () => {
    const schema = new GraphQLPlatform({
      default: () => ({
        operations: {
          mutations: false,
        },
      }),
      resources: {
        Test: {
          uniques: ['id'],
          fields: {
            id: {
              type: GraphQLID,
            },
          },
        },
      },
    }).getGraphQLSchema();
    const validation = validateSchema(schema);

    expect(validation).toHaveLength(0);
  });

  it('creates an invalid GraphQL schema with resource and without operations', () => {
    const schema = new GraphQLPlatform({
      default: () => ({
        operations: false,
      }),
      resources: {
        Test: {
          uniques: ['id'],
          fields: {
            id: {
              type: GraphQLID,
            },
          },
        },
      },
    }).getGraphQLSchema();
    const validation = validateSchema(schema);

    expect(validation).toHaveLength(1);
    expect(validation[0].message).toEqual('Query root type must be provided.');
  });

  it('creates an invalid GraphQL schema without resources', () => {
    const schema = new GraphQLPlatform({}).getGraphQLSchema();
    const validation = validateSchema(schema);

    expect(validation).toHaveLength(1);
    expect(validation[0].message).toEqual('Query root type must be provided.');
  });
});
