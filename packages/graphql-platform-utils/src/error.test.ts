import { describe, expect, it } from '@jest/globals';
import { AggregateGraphError, GraphError } from './error.js';
import { addPath } from './path.js';

describe('Error', () => {
  describe('GraphError', () => {
    const configPath = addPath(undefined, 'GraphQLPlatformConfig');
    const nodesConfigPath = addPath(configPath, 'nodes');
    const node2ConfigPath = addPath(nodesConfigPath, 2);

    it.each<[error: Error, expectation: string]>([
      [
        new GraphError('My error', { path: configPath }),
        '/GraphQLPlatformConfig - My error',
      ],
      [
        new GraphError('My error with a cause', {
          path: configPath,
          cause: new TypeError('Expects an integer'),
        }),
        '/GraphQLPlatformConfig - My error with a cause',
      ],
      [
        new AggregateGraphError(
          [
            new GraphError('Invalid string', {
              path: addPath(configPath, 'description'),
            }),
            new AggregateGraphError(
              [
                new GraphError('Invalid Name', {
                  path: addPath(addPath(nodesConfigPath, 0), 'description'),
                }),
                new AggregateGraphError(
                  [
                    new GraphError('Invalid Name', {
                      path: addPath(node2ConfigPath, 'name'),
                      cause: new TypeError('Must be a string'),
                    }),
                    new GraphError('Invalid Name', {
                      path: addPath(node2ConfigPath, 'description'),
                    }),
                  ],
                  { path: node2ConfigPath },
                ),
                new GraphError('Invalid Name', {
                  path: addPath(addPath(nodesConfigPath, 4), 'name'),
                  cause: new TypeError('Must be a string'),
                }),
              ],
              { path: nodesConfigPath },
            ),
            new GraphError('Invalid Name', {
              path: addPath(configPath, 'name'),
              cause: new TypeError('Must be a string'),
            }),
          ],
          { path: configPath },
        ),
        `/GraphQLPlatformConfig - 3 errors:`,
      ],
    ])('displays useful informations', (error, expectation) => {
      expect(() => {
        throw error;
      }).toThrow(expectation);
    });
  });
});
