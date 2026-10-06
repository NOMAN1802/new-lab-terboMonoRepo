const { build } = require('esbuild');
const pkg = require('../package.json');

// Workspace packages ship raw TypeScript, so they are inlined; everything else
// stays external and is installed normally by Vercel.
const external = Object.keys(pkg.dependencies).filter((d) => !d.startsWith('@repo/'));

build({
  entryPoints: ['src/vercel.ts'],
  outfile: 'dist/vercel-bundle.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external,
}).catch(() => process.exit(1));
