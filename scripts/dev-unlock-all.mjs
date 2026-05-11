#!/usr/bin/env node
//
// Dev helper. Inserts every species (15) and every animation found on disk
// as owned unlocks so a tester can poke at the full UI without grinding.
// Idle is skipped — it's the free baseline and gets auto-granted with each
// species anyway, so explicit rows are redundant.
//
// Self-bootstrap: better-sqlite3's native module was compiled against
// Electron's bundled Node, so plain `node` from PATH usually fails with
// NODE_MODULE_VERSION mismatch. If invoked outside Electron, this script
// re-exec's itself under `./node_modules/.bin/electron` with
// ELECTRON_RUN_AS_NODE=1.
//
// Usage (any platform):
//   node scripts/dev-unlock-all.mjs
//   npm run dev:unlock-all
//
// Safe to re-run — INSERT OR IGNORE means no duplicate rows or bit charges.
// Works while the app is running; the renderer picks up changes on next
// ingest tick or panel-tab interaction (which triggers a refetch).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// --- Self-bootstrap under Electron-as-Node -----------------------------------

if (!process.versions.electron) {
  const electronBin = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron',
  );
  if (!fs.existsSync(electronBin)) {
    console.error(`Electron not found at ${electronBin}. Run \`npm install\` first.`);
    process.exit(1);
  }
  // Windows: electron.cmd is a batch shim, so spawn needs shell:true to
  // resolve it via cmd.exe. Quote the script path because it lives in a
  // user-folder path that may contain spaces.
  const isWindows = process.platform === 'win32';
  const child = spawn(
    isWindows ? `"${electronBin}"` : electronBin,
    [`"${__filename}"`, ...process.argv.slice(2).map((a) => `"${a}"`)],
    {
      stdio: 'inherit',
      shell: isWindows,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    },
  );
  child.on('exit', (code) => process.exit(code ?? 0));
  // Important — bail before importing better-sqlite3, which would otherwise
  // crash on the version mismatch.
  // eslint-disable-next-line no-undef
  await new Promise(() => {});
}

// --- Real work (runs under Electron's Node) ----------------------------------

const { default: Database } = await import('better-sqlite3');

const SPECIES = [
  'wizard', 'slime', 'robot', 'flying_eye', 'bat', 'mimic', 'evil_wizard',
  'fire_worm', 'martial_hero', 'martial_hero_2', 'apprentice_wizard',
  'goblin', 'skeleton', 'mushroom', 'rat',
];

// Mirror the scanner's canonical-name rule. Keep this in sync with
// src/main/sprites.ts → canonicalAnimationName. Folder names map to one
// stable unlock id suffix so the shop and this script agree.
function canonicalAnimationName(rawName) {
  const cleaned = rawName.replace(/-[a-f0-9]{6,}$/i, '').toLowerCase();
  if (/idle|breath/.test(cleaned)) return 'idle';
  if (/^run/.test(cleaned)) return 'run';
  if (/^walk/.test(cleaned)) return 'walk';
  if (/^(attack|cast|fight|hit)$/.test(cleaned)) return 'attack';
  return cleaned;
}

// Mirror Electron's app.getPath('userData') for the `codeling` package name.
// In dev mode Electron uses package.json `name` (lowercase) — the prod
// `productName` only applies once packaged. The user's DB lives at:
//   Win:   %APPDATA%\codeling\codeling.db
//   macOS: ~/Library/Application Support/codeling/codeling.db
//   Linux: ~/.config/codeling/codeling.db
function userDataDir() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'codeling');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'codeling');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'codeling');
}

const dbPath = path.join(userDataDir(), 'codeling.db');
if (!fs.existsSync(dbPath)) {
  console.error(`No save found at ${dbPath}. Run Codeling at least once first.`);
  process.exit(1);
}
console.log(`Save: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const SPRITES_ROOT = path.join(REPO_ROOT, 'assets', 'sprites');
const now = Date.now();
const insert = db.prepare(
  `INSERT OR IGNORE INTO unlocks (item_id, category, acquired_via, acquired_at)
   VALUES (?, ?, 'dev', ?)`,
);

let speciesAdded = 0;
let animsAdded = 0;

const tx = db.transaction(() => {
  for (const species of SPECIES) {
    const r1 = insert.run(`species:${species}`, 'species', now);
    if (r1.changes > 0) speciesAdded++;

    const animsDir = path.join(SPRITES_ROOT, species, 'animations');
    if (!fs.existsSync(animsDir)) continue;

    const names = new Set();
    for (const folder of fs.readdirSync(animsDir)) {
      try {
        if (!fs.statSync(path.join(animsDir, folder)).isDirectory()) continue;
      } catch {
        continue;
      }
      names.add(canonicalAnimationName(folder));
    }
    for (const name of names) {
      if (name === 'idle') continue; // free baseline
      const r2 = insert.run(`anim:${species}:${name}`, 'animation', now);
      if (r2.changes > 0) animsAdded++;
    }
  }
});

tx();
db.close();

console.log(`Unlocked ${speciesAdded} new species + ${animsAdded} new animations`);
console.log('');
console.log('If Codeling is running, click around the tabs to trigger a refetch');
console.log('— or just send a message through Claude Code to fire `codeling:update`.');
