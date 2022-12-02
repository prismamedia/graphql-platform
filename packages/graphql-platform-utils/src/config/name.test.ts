import { addPath } from '../path.js';
import { assertName } from './name.js';

describe('Name', () => {
  const configPath = addPath(undefined, 'GraphQLPlatformConfig');
  const nameConfigPath = addPath(configPath, 'name');

  it.each<[value: string]>([['myName'], ['MyName']])(
    'assertName(%p)',
    (value) => expect(assertName(value, nameConfigPath)).toBeUndefined(),
  );

  it.each<[invalidValue: any, error: string]>([
    [{}, `"GraphQLPlatformConfig.name" - Expects a non-empty string, got: {}`],
    ['', `"GraphQLPlatformConfig.name" - Expects a non-empty string, got: ''`],
    [
      '-myInvalidName',
      `"GraphQLPlatformConfig.name" - Expects to be valid against the GraphQL \"Names\" specification (@see: https://spec.graphql.org/draft/#sec-Names), got: '-myInvalidName'
└ Cause: Names must start with [_a-zA-Z] but \"-myInvalidName\" does not.`,
    ],
  ])('assertName(%p) throws the error %p', (invalidValue, error) =>
    expect(() => assertName(invalidValue, nameConfigPath)).toThrowError(error),
  );
});