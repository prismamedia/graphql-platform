import { GraphQLSchema, printSchema, validateSchema } from 'graphql';
import { config, MyGP } from './gp';

describe('GraphQLSchema', () => {
  let gp: MyGP;
  let schema: GraphQLSchema;

  beforeAll(() => {
    gp = new MyGP(config);
    schema = gp.getGraphQLSchema();
  });

  it('creates a valid GraphQL schema', () => {
    expect(validateSchema(schema)).toHaveLength(0);
  });

  it('creates a consistent GraphQL schema', () => {
    expect(printSchema(schema, { commentDescriptions: true })).toMatchSnapshot();
  });
});
