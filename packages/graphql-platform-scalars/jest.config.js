export default {
  displayName: 'Scalars',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          target: 'es2022',
        },
      },
    ],
  },
};
