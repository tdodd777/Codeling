#!/usr/bin/env node
//
// Install / uninstall / inspect Codeling's Stop hook in ~/.claude/settings.json.
//
// Stop hooks fire on every Claude Code turn end; by POSTing each event to
// http://127.0.0.1:4318/codeling/stop-hook we add a supplementary message
// tally that catches turns the OTEL exporter dropped. See
// src/main/stop-hook.ts for the receiver-side algorithm.
//
// Modes:
//   install     Add Codeling's Stop hook entry (idempotent).
//   uninstall   Remove it.
//   status      Show whether it's present + the current entry.
//
// Endpoint defaults to http://127.0.0.1:4318/codeling/stop-hook. Override:
//   ENDPOINT=http://127.0.0.1:4318/codeling/stop-hook node ./scripts/install-stop-hook.mjs install
//
// Usage:
//   node ./scripts/install-stop-hook.mjs [install|uninstall|status]
//
// We tag our entry by including a marker substring in the command. Uninstall
// filters by that substring so we never touch hook entries the user added by
// hand.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SETTINGS_DIR = path.join(os.homedir(), '.claude');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');
const MARKER = '/codeling/stop-hook';
const ENDPOINT = process.env.ENDPOINT || 'http://127.0.0.1:4318/codeling/stop-hook';

// `--data-binary @-` reads the hook's JSON event from stdin verbatim. -sS
// quiets curl's progress bar but keeps errors visible. -m 2 caps wait at 2s
// so a Codeling-not-running situation doesn't slow Claude turn endings.
const command = `curl -sS -m 2 -X POST -H "Content-Type: application/json" --data-binary @- ${ENDPOINT}`;

const codelingHookEntry = {
  matcher: '',
  hooks: [
    {
      type: 'command',
      command,
    },
  ],
};

function isCodelingHookEntry(entry) {
  if (!entry || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some(
    (h) => typeof h?.command === 'string' && h.command.includes(MARKER),
  );
}

async function readSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  const raw = await readFile(SETTINGS_PATH, 'utf8');
  if (raw.trim().length === 0) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${SETTINGS_PATH}: ${err.message}`);
  }
}

async function writeSettings(settings) {
  if (!existsSync(SETTINGS_DIR)) mkdirSync(SETTINGS_DIR, { recursive: true });
  // Pretty-print to keep the file legible if the user ever opens it. The
  // Claude Code reader doesn't care about whitespace.
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function getStopArray(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') return [];
  if (!Array.isArray(settings.hooks.Stop)) return [];
  return settings.hooks.Stop;
}

function setStopArray(settings, arr) {
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
  if (arr.length === 0) {
    delete settings.hooks.Stop;
  } else {
    settings.hooks.Stop = arr;
  }
}

async function install() {
  const settings = await readSettings();
  const existing = getStopArray(settings);
  // Drop any prior Codeling entries (handles re-install with new endpoint),
  // then append the fresh one. Other Stop hooks the user has installed are
  // preserved verbatim.
  const filtered = existing.filter((e) => !isCodelingHookEntry(e));
  filtered.push(codelingHookEntry);
  setStopArray(settings, filtered);
  await writeSettings(settings);
  console.log(`Codeling Stop hook installed at ${SETTINGS_PATH}`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log('Restart Claude Code (or new sessions will pick it up automatically).');
}

async function uninstall() {
  const settings = await readSettings();
  const existing = getStopArray(settings);
  const filtered = existing.filter((e) => !isCodelingHookEntry(e));
  if (filtered.length === existing.length) {
    console.log('No Codeling Stop hook entry found — nothing to remove.');
    return;
  }
  setStopArray(settings, filtered);
  await writeSettings(settings);
  console.log(`Codeling Stop hook removed from ${SETTINGS_PATH}`);
}

async function status() {
  if (!existsSync(SETTINGS_PATH)) {
    console.log(`No ${SETTINGS_PATH} present yet — Stop hook is not installed.`);
    return;
  }
  const settings = await readSettings();
  const existing = getStopArray(settings);
  const ours = existing.filter(isCodelingHookEntry);
  if (ours.length === 0) {
    console.log('Codeling Stop hook is not installed.');
    if (existing.length > 0) {
      console.log(`(${existing.length} other Stop hook entr${existing.length === 1 ? 'y' : 'ies'} present.)`);
    }
    return;
  }
  console.log('Codeling Stop hook present:');
  console.log(JSON.stringify(ours, null, 2));
}

const mode = process.argv[2] ?? 'install';
const handlers = { install, uninstall, status };
const handler = handlers[mode];
if (!handler) {
  console.error(`Usage: node ${path.relative(process.cwd(), process.argv[1])} [install|uninstall|status]`);
  process.exit(2);
}

handler().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
