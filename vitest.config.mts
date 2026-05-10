import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Pure-logic tests only — files under src/main/ that import electron, fs/path
// in ways that need a real cwd, or better-sqlite3 (native module) are not yet
// covered. See PLAN.md "No tests yet" risk note for the planned next pass.

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
