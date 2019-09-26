import { printSchema } from 'graphql';
import { gp } from './gp';

describe('GraphQL Platform', () => {
  it('generates a valid GraphQL Schema', () => {
    expect(
      printSchema(gp.schema, { commentDescriptions: true }),
    ).toMatchSnapshot();
  });
});
