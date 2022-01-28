import * as graphql from 'graphql';
import { castToError, UnexpectedConfigError } from '../error.js';
import type { Path } from '../path.js';

/**
 * A string compliant with the GraphQL specification
 *
 * @see https://spec.graphql.org/draft/#sec-Names
 */
export type Name = string;

/**
 * @see https://spec.graphql.org/draft/#sec-Names
 */
export function assertName(
  maybeName: unknown,
  path: Path,
): asserts maybeName is Name {
  if (typeof maybeName !== 'string' || !maybeName) {
    throw new UnexpectedConfigError(`a non-empty string`, maybeName, {
      path,
    });
  }

  try {
    graphql.assertName(maybeName);
  } catch (error) {
    throw new UnexpectedConfigError(
      'to be valid against the GraphQL "Names" specification (@see: https://spec.graphql.org/draft/#sec-Names)',
      maybeName,
      { path, cause: castToError(error) },
    );
  }
}

/**
 * @see https://spec.graphql.org/draft/#sec-Names
 */
export function ensureName(maybeName: unknown, path: Path): Name {
  assertName(maybeName, path);

  return maybeName;
}
