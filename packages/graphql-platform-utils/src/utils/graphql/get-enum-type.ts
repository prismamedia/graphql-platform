import { GraphQLEnumType, GraphQLEnumValueConfigMap } from 'graphql';
import { POJO } from '../../types/pojo';
import { getEnumKeys } from '../enum';

export function getGraphQLEnumType(name: string, enumerable: POJO, useKeyAsValue: boolean = false): GraphQLEnumType {
  return new GraphQLEnumType({
    name,
    values: getEnumKeys(enumerable).reduce(
      (values: GraphQLEnumValueConfigMap, key) =>
        Object.assign(values, { [key]: { value: useKeyAsValue ? key : enumerable[key] } }),
      Object.create(null),
    ),
  });
}
