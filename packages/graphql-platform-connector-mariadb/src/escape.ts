import * as utils from '@prismamedia/graphql-platform-utils';

export function escapeIdentifier(identifier: string): string {
  if (!identifier) {
    throw new utils.UnexpectedValueError('a non-empty string', identifier);
  } else if (identifier.includes('\u0000')) {
    throw new utils.UnexpectedValueError(
      'not to contain the null character "u0000"',
      identifier,
    );
  }

  return `\`${identifier.replaceAll('`', '``').replaceAll('.', '`.`')}\``;
}

/**
 * @see https://mariadb.com/kb/en/string-literals/#escape-sequences
 */
const escapedSequences = new Map([
  ['\x00', '\\0'],
  ["'", "\\'"],
  ['"', '\\"'],
  ['\b', '\\b'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
  ['\x1A', '\\Z'],
  ['\\', '\\\\'],
]);

const escapedSequencesRegexp = new RegExp(
  Array.from(escapedSequences.keys(), (sequence) =>
    sequence.replaceAll(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'),
  ).join('|'),
  'g',
);

export function escapeStringValue(value: string): string {
  return `'${value.replaceAll(
    escapedSequencesRegexp,
    (match) => escapedSequences.get(match)!,
  )}'`;
}
