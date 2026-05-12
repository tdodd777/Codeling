import { defineConfig } from 'vite';
import path from 'node:path';

// Bundle pure-JS deps into main.js so they ship inside app.asar — Forge's
// plugin-vite doesn't include node_modules by default, so anything left
// external would crash with "Cannot find module 'X'" at runtime.
//
// Keep external:
//   - electron     — provided by the Electron runtime itself
//   - better-sqlite3 — native module (.node binary); can't be bundled.
//     Handled by @electron-forge/plugin-auto-unpack-natives, which copies
//     it into app.asar.unpacked/node_modules and adds an asar.unpack rule.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      external: ['electron', 'better-sqlite3'],
      output: {
        entryFileNames: 'main.js',
      },
    },
  },
});
