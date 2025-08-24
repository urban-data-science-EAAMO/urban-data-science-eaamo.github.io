module.exports = {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        // Override tsconfig options for tests
        verbatimModuleSyntax: false,
      }
    }]
  },
  moduleNameMapper: {
    'astro:content': '<rootDir>/src/utils/__mocks__/astroContent.js',
    '\\.js$': '<rootDir>/node_modules/babel-jest'
  },
  testPathIgnorePatterns: ['/node_modules/'],
  extensionsToTreatAsEsm: ['.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
}