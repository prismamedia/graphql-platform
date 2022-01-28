import {
  addPath,
  NestableError,
  UnexpectedValueError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import * as graphql from 'graphql';

const GRAPHQL_DATE_REGEX = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

function parseDate(value: unknown, path?: Path): Date {
  if (value instanceof Date) {
    if (
      !Number.isNaN(value.getTime()) &&
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    ) {
      return value;
    }

    throw new UnexpectedValueError(
      'a valid Date instance without any time informations',
      value,
      { path },
    );
  } else if (typeof value === 'string') {
    const matches = GRAPHQL_DATE_REGEX.exec(value);
    if (matches) {
      const coercedValue = new Date(
        Date.UTC(
          parseInt(matches.groups!.year, 10),
          parseInt(matches.groups!.month, 10) - 1,
          parseInt(matches.groups!.day, 10),
          0,
          0,
          0,
          0,
        ),
      );

      if (
        !Number.isNaN(coercedValue.getTime()) &&
        coercedValue.toISOString().split('T')[0] === value
      ) {
        return coercedValue;
      }
    }

    throw new UnexpectedValueError(
      'a date string compliant with the ISO 8601 extended format',
      value,
      { path },
    );
  }

  throw new UnexpectedValueError(
    'a valid Date instance without any time informations or a date string compliant with the ISO 8601 extended format',
    value,
    { path },
  );
}

export const GraphQLDate = new graphql.GraphQLScalarType({
  name: 'Date',
  description:
    'A date string, such as "2007-12-03", compliant with the ISO 8601 extended format.',
  specifiedByURL: 'https://en.wikipedia.org/wiki/ISO_8601',
  parseValue(value: unknown) {
    return parseDate(value, addPath(undefined, this.name));
  },
  parseLiteral(ast) {
    const path = addPath(undefined, this.name);

    if (ast.kind === graphql.Kind.STRING) {
      return parseDate(ast.value, addPath(undefined, this.name));
    }

    throw new NestableError(`Cannot parse literal: ${graphql.print(ast)}`, {
      path,
    });
  },
  serialize(value: unknown) {
    return parseDate(value, addPath(undefined, this.name))
      .toISOString()
      .split('T')[0];
  },
});
