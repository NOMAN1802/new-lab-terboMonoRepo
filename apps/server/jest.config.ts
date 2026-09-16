import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@repo/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@repo/utils$': '<rootDir>/../../packages/utils/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/app.ts',
  ],
  coverageReporters: ['text', 'lcov', 'json'],
  coverageDirectory: 'coverage',
  // Start low — will increase as coverage grows through Phase 5 iterations
  // Threshold reflects current coverage (2 utility files tested).
  // Raise incrementally as more tests are added.
  coverageThreshold: {
    global: { statements: 2, branches: 2, functions: 2, lines: 2 },
  },
};

export default config;
