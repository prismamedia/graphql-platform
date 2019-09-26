import { GraphQLError, Kind, print, ValueNode } from 'graphql';
import { URL } from 'url';
import { GraphQLScalarType } from '../types';

export function assertURLValue(value: unknown): URL {
  if (value instanceof URL) {
    return value;
  } else if (typeof value === 'string') {
    try {
      return new URL(value);
    } catch (error) {
      throw new TypeError(
        `URL expects an url, got the error: ${error.message}`,
      );
    }
  }

  throw new TypeError(`URL expects an url, got "${value}"`);
}

export const GraphQLURL = new GraphQLScalarType({
  name: 'URL',
  description:
    'A field whose value conforms to the standard URL format as specified in RFC3986.',
  specifiedByUrl: 'https://www.ietf.org/rfc/rfc3986.txt',
  serialize: (value: any) => assertURLValue(value).toString(),
  parseValue: assertURLValue,
  parseLiteral(valueNode: ValueNode) {
    if (valueNode.kind !== Kind.STRING) {
      throw new GraphQLError(
        `URL cannot represent a non string value: ${print(valueNode)}`,
        valueNode,
      );
    }

    return assertURLValue(valueNode.value);
  },
});
