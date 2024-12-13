import assert from 'node:assert';
import { describe, it } from 'node:test';
import { AggregateGraphError, GraphError } from './error.js';
import { addPath } from './path.js';

describe('Error', () => {
  describe('GraphError', () => {
    const configPath = addPath(undefined, 'GraphQLPlatformConfig');
    const nodesConfigPath = addPath(configPath, 'nodes');
    const node2ConfigPath = addPath(nodesConfigPath, 2);

    const cases = [
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
    ] as const;

    cases.forEach(([error, expectation]) =>
      it(`displays useful informations`, () => {
        assert.throws(
          () => {
            throw error;
          },
          { message: new RegExp(expectation) },
        );
      }),
    );
  });
});
