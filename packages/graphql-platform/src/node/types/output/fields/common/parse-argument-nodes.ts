import { PlainObject } from '@prismamedia/graphql-platform-utils';
import { ArgumentNode, GraphQLResolveInfo, valueFromASTUntyped } from 'graphql';

export const parseArgumentNodes = (
  args: ReadonlyArray<ArgumentNode>,
  variables?: GraphQLResolveInfo['variableValues'],
): PlainObject =>
  Object.fromEntries(
    args.map(({ name, value }) => [
      name.value,
      valueFromASTUntyped(value, variables),
    ]),
  );
