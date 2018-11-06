import { GraphQLEnumType } from 'graphql';

export function getGraphQLEnumType(name: string, values: { [key: string]: string }): GraphQLEnumType {
  return new GraphQLEnumType({
    name,
    values: Object.entries(values).reduce((values, [key, value]) => Object.assign(values, { [key]: { value } }), {}),
  });
}
