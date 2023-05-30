export default {
  displayName: 'MariaDB Connector',
  testMatch: ['<rootDir>/src/**/*.test.ts'],

  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { decoratorVersion: '2021-12' },
          target: 'es2022',
        },
      },
    ],
  },
};
