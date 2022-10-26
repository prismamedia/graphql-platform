import * as utils from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

const GRAPHQL_DATE_TIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}(:?\d{2})?))$/;

export function parseDateTime(value: unknown, path?: utils.Path): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new utils.UnexpectedValueError('a valid Date instance', value, {
        path,
      });
    }

    return value;
  } else if (typeof value === 'number') {
    const coercedValue = new Date(value);
    if (
      Number.isNaN(coercedValue.getTime()) ||
      coercedValue.getTime() !== value
    ) {
      throw new utils.UnexpectedValueError(
        'a number of milliseconds since the Unix Epoch',
        value,
        { path },
      );
    }

    return coercedValue;
  } else if (typeof value === 'string') {
    if (!GRAPHQL_DATE_TIME_REGEX.test(value)) {
      throw new utils.UnexpectedValueError(
        'a date-time string compliant with the ISO 8601 extended format',
        value,
        { path },
      );
    }

    const coercedValue = new Date(value);
    if (Number.isNaN(coercedValue.getTime())) {
      throw new utils.UnexpectedValueError('a valid date-time', value, {
        path,
      });
    }

    return coercedValue;
  }

  throw new utils.UnexpectedValueError(
    'a Date instance, a number of milliseconds since the Unix Epoch or a date-time string compliant with the ISO 8601 extended format',
    value,
    { path },
  );
}

export const GraphQLDateTime = new graphql.GraphQLScalarType({
  name: 'DateTime',
  description:
    'A date-time string, such as "2007-12-03T10:15:30.123Z", compliant with the ISO 8601 extended format.',
  specifiedByURL: 'https://en.wikipedia.org/wiki/ISO_8601',
  parseValue(value: unknown) {
    return parseDateTime(value);
  },
  parseLiteral(ast) {
    if (ast.kind === graphql.Kind.INT) {
      return parseDateTime(parseInt(ast.value, 10));
    } else if (ast.kind === graphql.Kind.STRING) {
      return parseDateTime(ast.value);
    }

    throw new TypeError(`Cannot parse literal: ${graphql.print(ast)}`);
  },
  serialize(value: unknown) {
    return parseDateTime(value).toISOString();
  },
});
