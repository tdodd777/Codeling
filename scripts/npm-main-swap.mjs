#!/usr/bin/env node
// Swaps package.json#main between the Electron entry (.vite/build/main.js) and
// the CLI entry (scripts/codeling-cli.mjs) around `npm publish`.
//
// Why: npm force-includes the file at `main` in the tarball regardless of the
// `files` whitelist. Pointing main at the bundled Electron main process bloats
// the npm package from ~10 kB to ~400 kB with code npm consumers never run.
//
// Wired into npm lifecycles via `prepublishOnly` (swap → CLI) and `postpublish`
// (restore → Electron entry). Both run only for `npm publish`, not `npm pack`
// or `npm install` from a git URL.
//
// If publish fails between the two hooks, the backup file `.npm-main-backup`
// is left on disk and the next swap will refuse to overwrite it — restore
// manually with `node scripts/npm-main-swap.mjs --restore`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(__dirname, '..', 'package.json');
const BACKUP = path.join(__dirname, '..', '.npm-main-backup');
const CLI_MAIN = 'scripts/codeling-cli.mjs';

const mode = process.argv[2];

if (mode === '--swap') {
  if (fs.existsSync(BACKUP)) {
    console.error(
      `[npm-main-swap] ${BACKUP} already exists — a previous swap did not restore.\n` +
      `  Run: node scripts/npm-main-swap.mjs --restore`,
    );
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  fs.writeFileSync(BACKUP, pkg.main);
  pkg.main = CLI_MAIN;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`[npm-main-swap] main: ${fs.readFileSync(BACKUP, 'utf8')} → ${CLI_MAIN}`);
} else if (mode === '--restore') {
  if (!fs.existsSync(BACKUP)) {
    console.log(`[npm-main-swap] no backup found — nothing to restore`);
    process.exit(0);
  }
  const original = fs.readFileSync(BACKUP, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  pkg.main = original;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
  fs.unlinkSync(BACKUP);
  console.log(`[npm-main-swap] main: ${CLI_MAIN} → ${original}`);
} else {
  console.error('Usage: node scripts/npm-main-swap.mjs --swap | --restore');
  process.exit(2);
}
