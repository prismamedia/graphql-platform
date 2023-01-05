import * as graphql from 'graphql';
import { UnexpectedValueError } from '../error.js';
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
    throw new UnexpectedValueError(`a non-empty string`, maybeName, {
      path,
    });
  }

  try {
    graphql.assertName(maybeName);
  } catch (error) {
    throw new UnexpectedValueError(
      'to be valid against the GraphQL "Names" specification (@see: https://spec.graphql.org/draft/#sec-Names)',
      maybeName,
      { cause: error, path },
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
