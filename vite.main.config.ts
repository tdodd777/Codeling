import { defineConfig } from 'vite';
import path from 'node:path';

// Native modules and Node built-ins must stay external so Vite doesn't try to bundle .node binaries.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        'better-sqlite3',
        '@grpc/grpc-js',
        '@grpc/proto-loader',
        'protobufjs',
        'express',
        'menubar',
        'electron',
      ],
      output: {
        entryFileNames: 'main.js',
      },
    },
  },
});
