import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  shims: true,
  target: 'node20',
  platform: 'node',
  external: [
    // vite
    'vite',
    // react ecosystem
    'react',
    'react-dom',
    'react-router-dom',
    // error boundary — re-exported from client.ts, must stay external
    // so users resolve it from bini-router's own dependency tree, not
    // from the bundled dist output
    'react-error-boundary',
    // hono (only needed packages)
    'hono',
    'hono/cors',
    // bini-env — runtime dep, not bundled
    'bini-env',
    // node built-ins
    'fs',
    'fs/promises',
    'path',
    'url',
    'http',
    'https',
    'os',
    'net',
    'stream',
    'stream/promises',
    'crypto',
    'buffer',
    'events',
    'util',
    'child_process',
  ],
  esbuildOptions(options) {
    options.platform = 'node';
    options.target = 'node20';
  },
});