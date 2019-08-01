import { GraphQLEnumType, GraphQLEnumValueConfigMap } from 'graphql';
import { POJO } from '../../types/pojo';

export function getGraphQLEnumType(name: string, enumerable: POJO, useKeyAsValue: boolean = false): GraphQLEnumType {
  return new GraphQLEnumType({
    name,
    values: Object.entries(enumerable).reduce(
      (values: GraphQLEnumValueConfigMap, [key, value]) =>
        !Number.isNaN(Number.parseInt(key))
          ? values
          : Object.assign(values, { [key]: { value: useKeyAsValue ? key : value } }),
      Object.create(null),
    ),
  });
}
