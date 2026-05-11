# Task: bundle `npx codeling install` as the real one-shot install

You're picking up the **distribution** work on Codeling, an Electron + TypeScript companion app for Claude Code users. The app lives in the system tray, gamifies engagement (species collection, animation unlocks, achievements, daily streaks), and feeds off OTLP telemetry from Claude Code sessions.

## Read first

- **`roadmap.md`** — forward-looking source of truth. What's built, what's queued, what's later. Update as you ship.
- **`DIRECTION.md`** — decisions log with rationale (the *why*). The vision target `npx codeling install` is documented at the top.
- **`scripts/codeling-cli.mjs`** — the existing CLI scaffold you'll extend. Has `install` / `uninstall` / `status` subcommands. Currently runs telemetry + Stop-hook installers; doesn't yet download the app binary.
- **`forge.config.ts`** — Electron Forge already wired with `MakerSquirrel` (Windows), `MakerZIP` (macOS), `MakerDeb`, `MakerRpm`. No publisher configured.
- **`package.json`** — `bin: { codeling: ./scripts/codeling-cli.mjs }` already exists; `private: true` will need to flip to `false` if/when publishing.

## Goal

Turn `npx codeling install` into a real one-shot install. Today it sets up env vars and the Stop hook but assumes the app is already running from a cloned repo. End state: a user runs that one command and gets a working tray app with telemetry wired up.

The pieces:

1. **Publish makers to GitHub Releases.** Add `@electron-forge/publisher-github` to `forge.config.ts`. The simplest distribution target — Forge auto-publishes installer artifacts on `npm run publish` once configured. Codeling lives at this repo's origin (check `git remote -v`).
2. **Replace `MakerZIP` with `MakerDMG` for macOS** so the download is a real installer, not a zip the user has to unpack manually. Add `@electron-forge/maker-dmg` as a devDep.
3. **CLI download step.** Extend `scripts/codeling-cli.mjs` → `install` subcommand: detect OS + arch, fetch the matching artifact from the latest GitHub Release via the API (`https://api.github.com/repos/<owner>/<repo>/releases/latest`), download, execute (.msi on Windows, .dmg auto-mount on macOS, .deb/.rpm via apt/yum/etc. on Linux), then run the existing telemetry + Stop-hook steps.
4. **Auto-update wiring.** Squirrel.Windows + Squirrel.Mac support auto-update via a feed URL. Use `electron`'s `autoUpdater` module with `update.electronjs.org` as the free hosting target (it takes a GitHub repo URL and serves Squirrel feeds). Hook it into `bootstrap()` in `src/main/index.ts` — touch this file lightly, the user is troubleshooting in parallel and the dev `npm start` flow must stay working.
5. **README update.** Document the user-facing install: `npx codeling install` as the headline + manual fallback (`npm run setup` from a cloned repo). Capture what dependencies users need (Node 18+).

## Hard constraints

- **Code signing requires paid certs.** Apple Developer ID (~$99/yr) and Authenticode (varies by CA). **Don't try to acquire them.** Wire the signing config in `forge.config.ts` as commented placeholders with a clear `TODO: paid cert` note so the path is obvious when certs land. Unsigned builds work — users see a "publisher unknown" warning on first launch but can dismiss it. Document this in the README.
- **Don't break dev mode.** `npm start` must keep working. Forge's `make`/`publish` configs are separate from `start`; they should coexist cleanly.
- **Don't restructure the CLI** — extend the existing subcommand pattern in `scripts/codeling-cli.mjs`. Mirror the existing `run()` helper for subprocess invocation.
- **The user is troubleshooting in parallel** with the app running. Most of your work belongs in `forge.config.ts`, `package.json`, `scripts/`, `README.md`. Avoid restarts-required changes in `src/main/` except a minimal `autoUpdater` hook.
- **No `npm publish` actually.** Get everything ready (private flag, README, version bump) but don't run `npm publish` — that's a one-way door the user should pull. Flag it in your final report.

## Conventions

- `roadmap.md` is the punch list. When work lands, move the entry from **In progress** / **Next up** to **Recently shipped** with the commit hash. New ideas → **Next up** (ordered) or **Later** (unscoped). Keep entries one or two lines.
- `DIRECTION.md` gets dated entries for non-trivial decisions with the rationale (`### 2026-05-11 — Chose GitHub Releases over self-hosted CDN: ...`).
- Conventional commits: `Verb: short summary` (under 70 chars). HEREDOC for multi-line bodies. Footer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Before each commit: `npm run lint` (tsc --noEmit) and `npm test` (vitest, 15 tests today). Don't regress.
- Memory note: the user has an established convention via `~/.claude/projects/.../memory/` (already loaded). Trust the two-doc split (DIRECTION + roadmap).

## Open decisions to flag back, not decide alone

- **Whether to flip `private: true` → `false` in `package.json`** and publish to npm now, or wait until distribution is shaken out. Flag the tradeoff; don't decide.
- **Auto-update default** — on or opt-in via Settings? There's already a Settings toggle for telemetry; the pattern's there. The user may want an explicit choice.
- **Release versioning cadence.** Currently `0.1.0`. Whether the first `make` build should be `0.1.0` (treating today as the launch) or `0.0.1` (treating this as pre-release) is the user's call.
- **macOS DMG branding** — background image, layout, drag-to-Applications arrow. Forge `MakerDMG` supports these. Worth nice defaults vs. raw is the user's call.

## Acceptance criteria

- `npm run make` produces installers in `out/make/` for the current OS without errors. Verify on Windows at minimum (where the user is).
- `npm run publish` (with a `GITHUB_TOKEN` env var, **do not run yourself** — leave instructions in the commit) would push artifacts to GitHub Releases. Configure but don't execute.
- `node scripts/codeling-cli.mjs install` end-to-end: detects OS, downloads artifact from the latest release, runs the installer, runs telemetry + Stop-hook installers. Test the download/install path with a mock or against a real GitHub release if one exists.
- `auto-updater` checks `update.electronjs.org` on app launch (with a 5-min debounce or similar) and prompts the user when a new version is available. Failure is silent — the app still works without updates.
- README has a user-facing install section: `npx codeling install` as the headline; `npm run setup` from a cloned repo as the manual path.
- `roadmap.md` updated: items move out of **Later → Distribution** into **Recently shipped** as you finish them.

## Suggested execution order

1. Inspect the current `forge.config.ts` + run `npm run make` to confirm baseline works.
2. Swap `MakerZIP` → `MakerDMG` for macOS. Re-test.
3. Add `publisher-github` config. Don't run `npm run publish` yet.
4. Wire the `autoUpdater` in `src/main/index.ts` (minimal touch).
5. Extend the CLI `install` subcommand with the GitHub-Release-download step. Use a real release for testing if one exists; otherwise stub the download with a clear TODO.
6. README pass.
7. Roadmap + DIRECTION updates.
8. Final report — what landed, what's open, what the user needs to manually do (npm publish, cert acquisition, first release tag).

Keep each commit small and focused. Don't pile changes together.

## Final report shape

When you're done (or hit a blocker), write a concise summary message:
- Commits landed (hash + one-line summary each)
- What works end-to-end
- What's stubbed / blocked / needs the user
- Next thing you'd touch if continuing

Don't dump file contents in the summary. The user will read the commits.
