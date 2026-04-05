import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  minify: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: 'node18',
  outDir: 'dist',
  banner: {
    js: '// Orbiter - A browser automation framework powered by AI\n// Author: Oshan Avishka\n// License: ISC',
  },
  onSuccess: 'echo "Build successful! 🎉"',
});