module.exports = {
  preset: 'ts-jest',
  testMatch: ['<rootDir>/**/*.test.ts'],
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
};
