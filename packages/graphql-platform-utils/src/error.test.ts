import { AggregateConfigError, ConfigError } from './error.js';
import { addPath } from './path.js';

describe('Error', () => {
  describe('ConfigError', () => {
    const configPath = addPath(undefined, 'GraphQLPlatformConfig');
    const nodesConfigPath = addPath(configPath, 'nodes');
    const node2ConfigPath = addPath(nodesConfigPath, 2);

    it.each<[error: Error, expectation: string]>([
      [
        new ConfigError('My error', { path: configPath }),
        '"GraphQLPlatformConfig" - My error',
      ],
      [
        new ConfigError('My error with cause', {
          path: configPath,
          cause: new TypeError('Expects an integer'),
        }),
        '"GraphQLPlatformConfig" - My error with cause',
      ],
      [
        new AggregateConfigError(
          [
            new ConfigError('Invalid string', {
              path: addPath(configPath, 'description'),
            }),
            new AggregateConfigError(
              [
                new ConfigError('Invalid Name', {
                  path: addPath(addPath(nodesConfigPath, 0), 'description'),
                }),
                new AggregateConfigError(
                  [
                    new ConfigError('Invalid Name', {
                      path: addPath(node2ConfigPath, 'name'),
                      cause: new TypeError('Must be a string'),
                    }),
                    new ConfigError('Invalid Name', {
                      path: addPath(node2ConfigPath, 'description'),
                    }),
                  ],
                  { path: node2ConfigPath },
                ),
                new ConfigError('Invalid Name', {
                  path: addPath(addPath(nodesConfigPath, 4), 'name'),
                  cause: new TypeError('Must be a string'),
                }),
              ],
              { path: nodesConfigPath },
            ),
            new ConfigError('Invalid Name', {
              path: addPath(configPath, 'name'),
              cause: new TypeError('Must be a string'),
            }),
          ],
          { path: configPath },
        ),
        `\"GraphQLPlatformConfig\" - 3 errors:
└ \"description\" - Invalid string
└ \"nodes\" - 3 errors:
  └ \"0.description\" - Invalid Name
  └ \"2\" - 2 errors:
    └ \"name\" - Invalid Name
      └ Cause: Must be a string
    └ \"description\" - Invalid Name
  └ \"4.name\" - Invalid Name
    └ Cause: Must be a string
└ \"name\" - Invalid Name
  └ Cause: Must be a string`,
      ],
    ])('displays useful informations', (error, expectation) => {
      expect(() => {
        throw error;
      }).toThrowError(expectation);
    });
  });
});
