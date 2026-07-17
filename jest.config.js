const nextJest = require('next/jest');

// next/jest loads next.config.js and .env files, and sets up SWC transforms
// automatically — no separate babel/ts-jest config to keep in sync by hand.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@byk/ws-schema$': '<rootDir>/packages/ws-schema/index.ts',
    '^@byk/shared-types$': '<rootDir>/packages/shared-types/api-contracts.ts',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
};

module.exports = createJestConfig(customJestConfig);
