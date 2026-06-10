import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Emit relative asset URLs (mirrors the old CRA "homepage": "." setting).
  base: './',
  // The source files use the .js extension but contain JSX, so tell esbuild
  // to parse .js files in src/ as JSX rather than renaming every file.
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    // Keep the production output in /build to match the existing Netlify
    // publish directory and the project's .gitignore.
    outDir: 'build',
  },
});
