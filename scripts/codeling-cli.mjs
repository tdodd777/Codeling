#!/usr/bin/env node
//
// Codeling CLI — single entrypoint for setup tasks. Wraps the platform-specific
// telemetry installer and the cross-platform Stop hook installer so users run
// one command instead of three.
//
// Subcommands:
//   install     Download + install the app, then telemetry + Stop hook.
//   uninstall   Reverse of install (telemetry + Stop hook; app removal is manual).
//   status      Show what's installed.
//
// Usage:
//   node scripts/codeling-cli.mjs [install|uninstall|status]
//
// After publishing to npm:
//   npx codeling install
//
// Flags:
//   --skip-app    Skip the binary download (use when running from a cloned repo).
//   --skip-otel   Skip the telemetry env-var installer.
//   --skip-hook   Skip the Stop hook installer.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const GITHUB_OWNER = 'tdodd777';
const GITHUB_REPO = 'Codeling';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// ---- Platform detection -----------------------------------------------------

function isWindows() {
  return process.platform === 'win32';
}

function isMac() {
  return process.platform === 'darwin';
}

function isLinux() {
  return process.platform === 'linux';
}

// ---- Subprocess runner ------------------------------------------------------

// Runs a child process with stdout/stderr piped through to our own streams.
// Resolves with the exit code; callers decide what to do on non-zero.
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd ?? REPO_ROOT,
      stdio: opts.stdio ?? 'inherit',
      shell: opts.shell ?? false,
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

// ---- App binary download ----------------------------------------------------

// Picks the GitHub Release asset that matches the host OS + arch. Squirrel.Windows
// emits `Codeling-<version> Setup.exe` (x64) and a `.nupkg`; MakerDMG emits
// `Codeling-<version>.dmg` (universal or per-arch depending on packagerConfig);
// MakerDeb / MakerRpm emit `codeling_<version>_<arch>.deb` and the .rpm
// equivalent. We match by extension first since the version + arch suffix
// vary across forge versions.
function pickAsset(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const byExt = (exts) =>
    assets.find((a) =>
      exts.some((ext) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith(ext)),
    );
  if (isWindows()) return byExt(['.exe', '.msi']);
  if (isMac()) return byExt(['.dmg']);
  if (isLinux()) {
    // Prefer .deb on systems with apt; otherwise .rpm. The test for `apt` is
    // cheap enough to leave inline.
    const hasApt = existsSync('/usr/bin/apt') || existsSync('/usr/bin/apt-get');
    return hasApt ? byExt(['.deb']) ?? byExt(['.rpm']) : byExt(['.rpm']) ?? byExt(['.deb']);
  }
  return null;
}

async function fetchLatestRelease() {
  const headers = { 'User-Agent': 'codeling-cli', Accept: 'application/vnd.github+json' };
  // PAT helps avoid the 60/hour anonymous rate limit. Optional.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(LATEST_RELEASE_URL, { headers });
  if (res.status === 404) return null; // no release published yet
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function downloadAsset(asset, destDir) {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, asset.name);
  // Resume-skip: if a file with the right size is already there, reuse it.
  if (existsSync(dest) && statSync(dest).size === asset.size) {
    console.log(`Reusing already-downloaded ${asset.name}`);
    return dest;
  }
  console.log(`Downloading ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)…`);
  const headers = { 'User-Agent': 'codeling-cli', Accept: 'application/octet-stream' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(asset.browser_download_url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  await new Promise((resolve, reject) => {
    const out = createWriteStream(dest);
    out.on('error', reject);
    out.on('finish', resolve);
    // Node's web stream → node stream bridge; available in Node 18+.
    const reader = res.body.getReader();
    const pump = () =>
      reader.read().then(({ done, value }) => {
        if (done) {
          out.end();
          return;
        }
        out.write(Buffer.from(value));
        return pump();
      });
    pump().catch(reject);
  });
  return dest;
}

// Runs the downloaded installer. Each platform has its own conventions:
//   - Windows: Squirrel's .exe Setup runs interactively; the user sees a
//     short progress UI, then the app launches.
//   - macOS: mount the DMG and open it so Finder shows the drag-to-Applications
//     window. Auto-copying with cp would silently bypass the gatekeeper prompt.
//   - Linux: invoke the package manager, eliding sudo (let the user choose).
async function runInstaller(filePath) {
  if (isWindows()) {
    console.log(`Launching installer: ${filePath}`);
    // Spawn detached so the installer keeps running after the CLI exits.
    const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
    return 0;
  }
  if (isMac()) {
    console.log(`Opening DMG: ${filePath}`);
    console.log('  → Drag Codeling into Applications, then eject the DMG.');
    return run('open', [filePath]);
  }
  if (isLinux()) {
    if (filePath.endsWith('.deb')) {
      console.log(`Run: sudo dpkg -i "${filePath}"`);
      console.log('  (then `sudo apt-get install -f` if dependencies are missing)');
    } else if (filePath.endsWith('.rpm')) {
      console.log(`Run: sudo rpm -i "${filePath}"`);
    }
    return 0; // don't auto-elevate
  }
  return 0;
}

async function downloadAndInstallApp() {
  console.log(`Looking up latest release at github.com/${GITHUB_OWNER}/${GITHUB_REPO}…`);
  let release;
  try {
    release = await fetchLatestRelease();
  } catch (err) {
    console.error(`  GitHub lookup failed: ${err.message}`);
    console.error('  Continuing — telemetry + Stop hook can still install. Re-run when');
    console.error('  the network is reachable, or use --skip-app to suppress this step.');
    return 0;
  }
  if (!release) {
    console.log('  No published release yet. Skipping app download.');
    console.log('  Manual install: clone the repo, `npm install`, `npm start`.');
    return 0;
  }
  const asset = pickAsset(release.assets);
  if (!asset) {
    console.log(`  Release ${release.tag_name} has no asset matching ${process.platform}.`);
    console.log('  Skipping app download — telemetry + Stop hook will still install.');
    return 0;
  }
  const destDir = path.join(os.tmpdir(), 'codeling-install');
  let filePath;
  try {
    filePath = await downloadAsset(asset, destDir);
  } catch (err) {
    console.error(`  Download failed: ${err.message}`);
    return 0;
  }
  const code = await runInstaller(filePath);
  // Best-effort cleanup of the Windows installer; macOS DMG stays so the user
  // can drag at their own pace, Linux .deb / .rpm stays so they can re-run
  // the package-manager command if elevation fails.
  if (isWindows()) {
    unlink(filePath).catch(() => {});
  }
  return code;
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

// ---- Flag parsing -----------------------------------------------------------

function parseFlags(argv) {
  const flags = new Set();
  for (const arg of argv) {
    if (arg.startsWith('--')) flags.add(arg);
  }
  return flags;
}

// ---- Subcommands ------------------------------------------------------------

async function install(flags) {
  console.log('Codeling — installing');
  console.log('');
  const steps = [];
  if (!flags.has('--skip-app')) steps.push(['App binary', () => downloadAndInstallApp()]);
  if (!flags.has('--skip-otel')) steps.push(['Telemetry env vars', () => runTelemetry('install')]);
  if (!flags.has('--skip-hook')) steps.push(['Stop hook', () => runStopHook('install')]);
  let i = 0;
  for (const [label, fn] of steps) {
    i++;
    console.log(`${i}/${steps.length} ${label}`);
    console.log('─'.repeat(Math.max(20, label.length + 4)));
    const code = await fn();
    if (code !== 0) {
      console.error(`${label} exited with code ${code}. Stopping.`);
      process.exitCode = code;
      return;
    }
    console.log('');
  }
  console.log('Done. Next:');
  console.log('  • Restart your shell so the new env vars take effect.');
  console.log('  • Launch Codeling from your applications menu (or wait for the');
  console.log('    Windows installer to open it for you).');
  console.log('  • Send a message through Claude Code and watch the tray come alive.');
}

async function uninstall() {
  console.log('Codeling — removing OS-level integrations');
  console.log('  (The Codeling app itself is untouched — uninstall it via the OS.)');
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
  console.log('Done.');
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

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith('--')) ?? 'install';
const flags = parseFlags(args);
const handlers = {
  install: () => install(flags),
  uninstall: () => uninstall(),
  status: () => status(),
};
const handler = handlers[mode];
if (!handler) {
  console.error(`Usage: codeling [install|uninstall|status] [--skip-app] [--skip-otel] [--skip-hook]`);
  process.exit(2);
}

handler().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
