import { printSchema, validateSchema } from 'graphql';
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
});
