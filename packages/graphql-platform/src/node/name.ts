import {
  assertName,
  UnexpectedConfigError,
  type Path,
} from '@prismamedia/graphql-platform-utils';
import inflection from 'inflection';

/**
 * A string in "PascalCase" compliant with the GraphQL "Names" specification
 *
 * @see https://spec.graphql.org/draft/#sec-Names
 */
export type NodeName = string;

export function assertNodeName(
  maybeNodeName: unknown,
  path: Path,
): asserts maybeNodeName is NodeName {
  assertName(maybeNodeName, path);

  // if (maybeNodeName.includes('_')) {
  //   throw new UnexpectedConfigError(
  //     `not to contain underscore`,
  //     maybeNodeName,
  //     { path },
  //   );
  // }

  // if (maybeNodeName.endsWith('Identifier')) {
  //   throw new UnexpectedConfigError(
  //     `not to end with "Identifier"`,
  //     maybeNodeName,
  //     { path },
  //   );
  // }

  const pascalCasedName = inflection.camelize(maybeNodeName, false);
  if (maybeNodeName !== pascalCasedName) {
    throw new UnexpectedConfigError(
      `to be in PascalCase (= "${pascalCasedName}")`,
      maybeNodeName,
      { path },
    );
  }
}
