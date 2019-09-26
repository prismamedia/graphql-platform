import { GraphQLError, Kind, print, ValueNode } from 'graphql';
import { GraphQLScalarType } from '../../types';

export function assertNonEmptyTrimmedStringValue(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError(
      `NonEmptyTrimmedString expects a string value, got "${value}"`,
    );
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new TypeError(
      `NonEmptyTrimmedString expects a non empty string, got "${value}"`,
    );
  }

  return trimmedValue;
}

export const GraphQLNonEmptyTrimmedString = new GraphQLScalarType({
  name: 'NonEmptyTrimmedString',
  description:
    'A string in which the leading and trailing whitespace characters are removed, plus it cannot be empty.',
  serialize: assertNonEmptyTrimmedStringValue,
  parseValue: assertNonEmptyTrimmedStringValue,
  parseLiteral(valueNode: ValueNode) {
    if (valueNode.kind !== Kind.STRING) {
      throw new GraphQLError(
        `NonEmptyTrimmedString cannot represent a non string value: ${print(
          valueNode,
        )}`,
        valueNode,
      );
    }

    return assertNonEmptyTrimmedStringValue(valueNode.value);
  },
});
