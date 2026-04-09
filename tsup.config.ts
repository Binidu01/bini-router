import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  shims: true,
  target: 'node18',
  external: [
    // vite
    'vite',
    // react ecosystem
    'react',
    'react-dom',
    'react-router-dom',
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
  },
});