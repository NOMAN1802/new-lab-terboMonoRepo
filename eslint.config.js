import baseConfig from './packages/eslint-config/index.js';

export default [
  ...baseConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/*.cjs',
    ],
  },
];
