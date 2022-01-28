export default {
  displayName: 'Scalars',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },

  // // ts-jest
  // preset: 'ts-jest/presets/default-esm',
  // globals: { 'ts-jest': { useESM: true } },

  // swc
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
  extensionsToTreatAsEsm: ['.ts'],
};
