import * as utils from '@prismamedia/graphql-platform-utils';

export type NodeName = utils.Name;

export function assertNodeName(
  maybeNodeName: unknown,
  path?: utils.Path,
): asserts maybeNodeName is NodeName {
  utils.assertName(maybeNodeName, path);

  if (!/^[A-Z][A-Za-z]*$/.test(maybeNodeName)) {
    throw new utils.UnexpectedValueError(
      'to be in "PascalCase"',
      maybeNodeName,
      { path },
    );
  }
}

export function ensureNodeName(
  maybeNodeName: unknown,
  path?: utils.Path,
): NodeName {
  assertNodeName(maybeNodeName, path);

  return maybeNodeName;
}
