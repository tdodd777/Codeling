import { defineConfig } from 'vite';
import path from 'node:path';

// Externalized deps stay as runtime `require(...)` calls in main.js and are
// loaded from node_modules at runtime. The `copyProductionDeps` afterCopy
// hook in forge.config.ts copies the full production dep closure into the
// packaged app's node_modules, so externalizing is safe for any dep listed
// in package.json `dependencies`.
//
// Must be external:
//   - electron       — provided by the Electron runtime itself
//   - better-sqlite3 — native module (.node binary); can't be bundled
//   - protobufjs     — has a "browser" field that Rollup picks by default,
//     swapping fs.readFileSync for XMLHttpRequest. Bundling crashes with
//     "XMLHttpRequest is not defined" when loading .proto files at runtime.
//   - @grpc/grpc-js, @grpc/proto-loader — do dynamic require()s for native
//     bindings and proto files; bundling breaks the runtime fs lookups
//     ("Cannot read properties of null (reading 'readFileSync')").
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'protobufjs',
        '@grpc/grpc-js',
        '@grpc/proto-loader',
      ],
      output: {
        entryFileNames: 'main.js',
      },
    },
  },
});
