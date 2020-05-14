import { GraphQLEnumType, GraphQLEnumValueConfigMap } from 'graphql';
import { POJO } from '../../types/pojo';
import { getEnumKeys } from '../enum';
import { fromEntries } from '../from-entries';
import { Entry } from '../get-plain-object-entries';

export function getGraphQLEnumType(
  name: string,
  enumerable: POJO,
  useKeyAsValue: boolean = false,
): GraphQLEnumType {
  return new GraphQLEnumType({
    name,
    values: fromEntries(
      getEnumKeys(enumerable).map(
        (key): Entry<GraphQLEnumValueConfigMap> => [
          key,
          { value: useKeyAsValue ? key : enumerable[key] },
        ],
      ),
    ),
  });
}
