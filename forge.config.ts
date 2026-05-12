import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { rebuild } from '@electron/rebuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

// plugin-vite intentionally drops node_modules from the build output (it
// assumes the user bundles everything with Vite). That breaks native modules
// like better-sqlite3, which can't be bundled — their .node binary needs to
// land in the packaged app's node_modules on disk.
//
// This hook copies the production dep closure into the build path AFTER
// plugin-vite has done its cleanup, and restores the `dependencies` field
// in the build's package.json so AutoUnpackNativesPlugin can detect them.
// The existing `asar.unpack: '**/*.node'` rule then ensures .node binaries
// land in app.asar.unpacked at install time.
async function copyProductionDeps(buildPath: string): Promise<void> {
  const projectRoot = __dirname;
  const projectPkg = JSON.parse(
    await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  );
  const seedDeps: string[] = Object.keys(projectPkg.dependencies ?? {});

  // BFS the production dep closure (deps + their transitive deps).
  const visited = new Set<string>();
  const queue = [...seedDeps];
  while (queue.length) {
    const name = queue.shift()!;
    if (visited.has(name)) continue;
    visited.add(name);
    try {
      const depPkg = JSON.parse(
        await fs.readFile(
          path.join(projectRoot, 'node_modules', name, 'package.json'),
          'utf8',
        ),
      );
      for (const t of Object.keys(depPkg.dependencies ?? {})) {
        if (!visited.has(t)) queue.push(t);
      }
      for (const t of Object.keys(depPkg.optionalDependencies ?? {})) {
        if (!visited.has(t)) queue.push(t);
      }
    } catch {
      // Missing dep or unreadable package.json — skip silently.
    }
  }

  await fs.mkdir(path.join(buildPath, 'node_modules'), { recursive: true });
  for (const name of visited) {
    const src = path.join(projectRoot, 'node_modules', name);
    const dst = path.join(buildPath, 'node_modules', name);
    try {
      await fs.cp(src, dst, { recursive: true });
    } catch {
      // Missing dep on disk — skip.
    }
  }

  // Restore the dependencies field so AutoUnpackNativesPlugin (which reads
  // buildPath/package.json) sees what to scan for native bindings.
  const buildPkgPath = path.join(buildPath, 'package.json');
  const buildPkg = JSON.parse(await fs.readFile(buildPkgPath, 'utf8'));
  buildPkg.dependencies = projectPkg.dependencies ?? {};
  await fs.writeFile(buildPkgPath, JSON.stringify(buildPkg, null, 2));
}

// Code signing & notarization are stubbed below. Both require paid certs:
//   - macOS: Apple Developer ID (~$99/yr) + an app-specific password for
//     `notarytool`. Set APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID env vars,
//     drop the .p12 into the keychain, then uncomment the osxSign + osxNotarize
//     blocks. See https://www.electronforge.io/guides/code-signing
//   - Windows: Authenticode cert from a CA (Sectigo, DigiCert, etc). Set
//     WINDOWS_CERT_FILE + WINDOWS_CERT_PASSWORD env vars, then uncomment the
//     certificateFile + certificatePassword in MakerSquirrel options.
//
// Unsigned builds work today — users see a "publisher unknown" warning on
// first launch but can dismiss it. Document this in the README.

// Build output goes outside the workspace so VS Code's file watcher can't grab
// a handle on app.asar between runs. (We're literally running inside VS Code,
// so we can't restart it to drop handles.) Override with FORGE_OUT_DIR if you
// want a different location for a one-off build.
const config: ForgeConfig = {
  outDir: process.env.FORGE_OUT_DIR ?? path.resolve(os.homedir(), '.codeling-build'),
  packagerConfig: {
    name: 'Codeling',
    asar: {
      unpack: '**/*.node',
    },
    extraResource: ['./assets', './proto'],
    afterCopy: [
      (buildPath, _electronVersion, _platform, _arch, callback) => {
        copyProductionDeps(buildPath)
          .then(() => callback())
          .catch((err: unknown) => callback(err instanceof Error ? err : new Error(String(err))));
      },
      // Rebuild native modules (e.g. better-sqlite3) against the Electron ABI.
      // Must run after copyProductionDeps so the modules exist in buildPath.
      // copyProductionDeps copies from project node_modules which are compiled
      // against the system Node; this step recompiles them for Electron's ABI.
      (buildPath, electronVersion, platform, arch, callback) => {
        rebuild({ buildPath, electronVersion, arch, platform })
          .then(() => callback())
          .catch((err: unknown) => callback(err instanceof Error ? err : new Error(String(err))));
      },
    ],
    // TODO: paid cert — uncomment once Apple Developer ID is provisioned.
    // osxSign: {
    //   identity: 'Developer ID Application: <Your Name> (<TEAMID>)',
    //   optionsForFile: () => ({ entitlements: 'build/entitlements.plist' }),
    // },
    // osxNotarize: {
    //   appleId: process.env.APPLE_ID!,
    //   appleIdPassword: process.env.APPLE_PASSWORD!,
    //   teamId: process.env.APPLE_TEAM_ID!,
    // },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // TODO: paid cert — uncomment once Authenticode cert is provisioned.
      // certificateFile: process.env.WINDOWS_CERT_FILE,
      // certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
    }),
    new MakerDMG({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    // Pushes maker outputs to GitHub Releases. Requires GITHUB_TOKEN env var
    // (a PAT with `repo` scope, or a workflow `secrets.GITHUB_TOKEN`).
    // Creates a draft release on first run; subsequent runs upload artifacts
    // to the matching version's release. Bump `version` in package.json before
    // running `npm run publish` to cut a new release.
    new PublisherGithub({
      repository: {
        owner: 'tdodd777',
        name: 'Codeling',
      },
      draft: true,
      prerelease: false,
    }),
  ],
  plugins: [
    // Detects native modules in node_modules (better-sqlite3 today) and
    // unpacks them from app.asar at install time so the .node binary is
    // loadable at runtime. Without this, requires for native deps fail with
    // "Cannot find module" since Forge's plugin-vite ships only the Vite
    // build output, not node_modules.
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
