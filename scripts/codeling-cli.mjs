#!/usr/bin/env node
//
// Codeling CLI — single entrypoint for setup tasks. Wraps the platform-specific
// telemetry installer and the cross-platform Stop hook installer so users run
// one command instead of three.
//
// Subcommands:
//   install     Run telemetry installer for OS + Stop hook installer.
//   uninstall   Reverse of install.
//   status      Show what's installed.
//
// Usage:
//   node scripts/codeling-cli.mjs [install|uninstall|status]
//
// After publishing to npm:
//   npx codeling install
//
// Distribution gap: this CLI does NOT yet download / install the app binary —
// `npm start` from a cloned repo is the dev-mode entry point. When prebuilt
// binaries land (see roadmap.md → Later → Distribution), `install` gains a
// download-binary step and `npx codeling install` becomes the north-star
// one-shot setup.

import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// ---- Platform detection -----------------------------------------------------

function isWindows() {
  return process.platform === 'win32';
}

// ---- Subprocess runner ------------------------------------------------------

// Runs a child process with stdout/stderr piped through to our own streams.
// Resolves with the exit code; callers decide what to do on non-zero.
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      shell: opts.shell ?? false,
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

// ---- Telemetry installer ----------------------------------------------------

async function runTelemetry(mode) {
  if (isWindows()) {
    const script = path.join(REPO_ROOT, 'scripts', 'install-telemetry.ps1');
    // `-ExecutionPolicy Bypass` so the user doesn't need to relax script
    // policy globally; the bypass is scoped to this invocation only.
    const code = await run(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, mode],
      {},
    );
    return code;
  }
  const script = path.join(REPO_ROOT, 'scripts', 'install-telemetry.sh');
  return run('bash', [script, mode], {});
}

// ---- Stop hook installer ----------------------------------------------------

async function runStopHook(mode) {
  const script = path.join(REPO_ROOT, 'scripts', 'install-stop-hook.mjs');
  return run(process.execPath, [script, mode], {});
}

// ---- Subcommands ------------------------------------------------------------

async function install() {
  console.log('Codeling — installing OS-level integrations');
  console.log('');
  console.log('1/2 Telemetry env vars');
  console.log('─────────────────────');
  const tCode = await runTelemetry('install');
  if (tCode !== 0) {
    console.error(`Telemetry installer exited with code ${tCode}. Stopping.`);
    process.exitCode = tCode;
    return;
  }
  console.log('');
  console.log('2/2 Stop hook');
  console.log('─────────────');
  const sCode = await runStopHook('install');
  if (sCode !== 0) {
    console.error(`Stop hook installer exited with code ${sCode}.`);
    process.exitCode = sCode;
    return;
  }
  console.log('');
  console.log('Done. Next:');
  console.log('  • Restart your shell so the new env vars take effect');
  console.log('    (or open a new terminal). VS Code / IDEs need a relaunch too.');
  console.log('  • Run `npm start` from this repo to launch Codeling.');
  console.log('  • Send a message through Claude Code and watch the tray come alive.');
}

async function uninstall() {
  console.log('Codeling — removing OS-level integrations');
  console.log('');
  console.log('1/2 Telemetry env vars');
  console.log('─────────────────────');
  const tCode = await runTelemetry('uninstall');
  if (tCode !== 0) {
    console.error(`Telemetry uninstall exited with code ${tCode}. Continuing.`);
  }
  console.log('');
  console.log('2/2 Stop hook');
  console.log('─────────────');
  const sCode = await runStopHook('uninstall');
  if (sCode !== 0) {
    console.error(`Stop hook uninstall exited with code ${sCode}.`);
    process.exitCode = sCode;
    return;
  }
  console.log('');
  console.log('Done. The Codeling app itself is untouched — close it manually if running.');
}

async function status() {
  console.log('Codeling — installation status');
  console.log('');
  console.log('Telemetry env vars');
  console.log('─────────────────');
  await runTelemetry('status');
  console.log('');
  console.log('Stop hook');
  console.log('─────────');
  await runStopHook('status');
  console.log('');
  console.log(`Platform: ${process.platform} (${os.release()})`);
  console.log(`Repo:     ${REPO_ROOT}`);
}

// ---- Dispatch ---------------------------------------------------------------

const mode = process.argv[2] ?? 'install';
const handlers = { install, uninstall, status };
const handler = handlers[mode];
if (!handler) {
  console.error(`Usage: codeling [install|uninstall|status]`);
  process.exit(2);
}

handler().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
