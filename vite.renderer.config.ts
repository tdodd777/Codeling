import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Single `assets/` folder at project root holds tray icons and sprites.
// publicDir copies it into the renderer bundle so `<img src="./sprites/...">` works
// both under the Vite dev server and a packaged file:// build.
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  publicDir: path.resolve(__dirname, 'assets'),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
