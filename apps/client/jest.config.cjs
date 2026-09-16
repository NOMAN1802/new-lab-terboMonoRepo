/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Override Vite-specific settings that are incompatible with ts-jest
          module: 'CommonJS',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          verbatimModuleSyntax: false,
          allowImportingTsExtensions: false,
          noEmit: false,
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        // Type checking is handled separately by tsc; keep test runs fast
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@repo/shared-types$':
      '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@repo/utils$': '<rootDir>/../../packages/utils/src/index.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/__mocks__/fileMock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/src/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/public-main.tsx',
  ],
  coverageReporters: ['text', 'lcov', 'json'],
  coverageDirectory: 'coverage',
  // Threshold reflects current coverage (1 utility file tested).
  // Raise incrementally as component/hook tests are added.
  coverageThreshold: {
    global: { statements: 0.5, branches: 0.5, functions: 0.5, lines: 0.5 },
  },
};

module.exports = config;
