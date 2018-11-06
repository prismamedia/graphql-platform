import { printSchema, validateSchema } from 'graphql';
import { graphqlPlatform } from '.';

describe('GraphQLSchema', () => {
  const schema = graphqlPlatform.getGraphQLSchema();

  it('creates a valid GraphQL schema', () => {
    expect(validateSchema(schema)).toHaveLength(0);
  });

  it('creates a consistent GraphQL schema', () => {
    expect(printSchema(schema, { commentDescriptions: true })).toMatchSnapshot();
  });
});
