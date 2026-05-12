import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Single `assets/` folder at project root holds tray icons and sprites.
// publicDir copies it into the renderer bundle so `<img src="./sprites/...">` works
// both under the Vite dev server and a packaged file:// build.
//
// `build.outDir` is forced to a project-root path because Forge's plugin-vite
// looks for renderer output at `<project>/.vite/renderer/<name>/` when
// packaging. Without this, Vite would write to `<root>/.vite/renderer/<name>/`
// (i.e. inside src/renderer/), and the packaged app would ship with no
// renderer HTML — leading to a blank window on launch.
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  publicDir: path.resolve(__dirname, 'assets'),
  build: {
    outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
