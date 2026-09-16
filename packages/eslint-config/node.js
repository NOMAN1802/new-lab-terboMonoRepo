import baseConfig from './index.js';
import tseslint from 'typescript-eslint';

/** Node/Express specific config — used by apps/server. */
export default tseslint.config(...baseConfig, {
  rules: {
    'no-console': 'off',
  },
});
