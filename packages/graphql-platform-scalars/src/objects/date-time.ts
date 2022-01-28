import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

const GRAPHQL_DATE_TIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}(:?\d{2})?))$/;

function parseDateTime(value: unknown, path?: Path): Date {
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return value;
    }

    throw new UnexpectedValueError('a valid Date instance', value, { path });
  } else if (typeof value === 'number') {
    const coercedValue = new Date(value);
    if (
      !Number.isNaN(coercedValue.getTime()) &&
      coercedValue.getTime() === value
    ) {
      return coercedValue;
    }

    throw new UnexpectedValueError(
      'a number of milliseconds since the Unix Epoch',
      value,
      { path },
    );
  } else if (typeof value === 'string') {
    if (GRAPHQL_DATE_TIME_REGEX.test(value)) {
      const coercedValue = new Date(value);
      if (!Number.isNaN(coercedValue.getTime())) {
        return coercedValue;
      }
    }

    throw new UnexpectedValueError(
      'a date-time string compliant with the ISO 8601 extended format',
      value,
      { path },
    );
  }

  throw new UnexpectedValueError(
    'a valid Date instance, a number of milliseconds since the Unix Epoch or a date-time string compliant with the ISO 8601 extended format',
    value,
    { path },
  );
}

export const GraphQLDateTime = new graphql.GraphQLScalarType({
  name: 'DateTime',
  description:
    'A date-time string, such as "2007-12-03T10:15:30.123Z", compliant with the ISO 8601 extended format.',
  specifiedByURL: 'https://en.wikipedia.org/wiki/ISO_8601',
  parseValue(value: unknown, path?: Path) {
    return parseDateTime(value, path ?? addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.INT) {
      return parseDateTime(parseInt(ast.value, 10), path);
    } else if (ast.kind === graphql.Kind.STRING) {
      return parseDateTime(ast.value, path);
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseDateTime(value, addPath(undefined, this.name)).toISOString();
  },
});
