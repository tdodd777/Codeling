# Codeling

A gamified pet companion for Claude Code. Lives in your menu bar (macOS) or system tray (Windows). The more you use Claude Code, the more your pet grows.

> **Status**: M0 → M1 → M5 (mostly) shipped. The game loop is live end-to-end: OTLP receivers ingest Claude Code telemetry, the economy awards XP/bits, the spin wheel + shop + species/animation unlocks work, achievements + daily streaks + daily summary fire, settings panel + save export/import + auto-launch toggle all land. Sprite roster is 14 species with art (PixelLab wizard + rvros slime + 12 LuizMelo CC0 creatures). Distribution is wired: `npx codeling install` downloads + runs the OS installer from GitHub Releases, then sets up telemetry + the Stop hook; auto-updater feeds from `update.electronjs.org`. What's still open: paid code-signing certs (unsigned builds work but trigger publisher-unknown warnings), the first published release, robot species art, and UX polish. See `DIRECTION.md` for the full roadmap and dated decision log; `sprites.md` for the asset catalog.

## Stack

- Electron Forge + Vite + React 18 + TypeScript
- `menubar` for cross-platform tray
- `better-sqlite3` for local pet/session state
- OpenTelemetry receivers — both OTLP/HTTP (`:4318`) and OTLP/gRPC (`:4317`)
- Sprite assets: original wizard from [PixelLab](https://pixellab.ai/) (paid); rest of the roster (slime + 12 monsters/creatures) from CC0 itch.io packs — see `sprites.md`

## Install

**Requirements:** Node 18+ (`node --version`). Claude Code installed and working.

```bash
npx codeling install
```

That one command:

1. Downloads the installer for your OS from the latest [GitHub Release](https://github.com/tdodd777/Codeling/releases) (`.exe` on Windows, `.dmg` on macOS, `.deb` / `.rpm` on Linux) and runs it.
2. Sets the User-scope OTEL env vars so every Claude Code session feeds Codeling's receiver.
3. Installs the Stop hook in `~/.claude/settings.json` for a backup per-turn message tally.

Flags: `--skip-app`, `--skip-otel`, `--skip-hook` for staged installs.

> **Unsigned builds**: until code signing certs are wired (paid Apple Developer ID + Authenticode), the first launch shows a "publisher unknown" / "unidentified developer" warning. Dismiss it once; subsequent launches are silent.

After install, restart your shell so the new env vars propagate (IDEs / VS Code need a relaunch too). Send a message through Claude Code and watch the tray pet level up.

### Uninstall

```bash
npx codeling uninstall          # removes telemetry + Stop hook
```

The app itself is removed via the OS — *Add or Remove Programs* on Windows, drag-to-Trash on macOS, `apt remove codeling` / `rpm -e codeling` on Linux.

### Status

```bash
npx codeling status             # shows env vars + Stop hook + platform
```

## Manual install (from source)

For development or if you'd rather run from a clone:

```bash
git clone https://github.com/tdodd777/Codeling.git
cd Codeling
npm install
npm run setup          # same as `npx codeling install --skip-app`
npm start              # launches the app from source
```

`npm start` is the Forge dev loop — Vite HMR for the renderer, hot main-process reload on save (type `rs` in the terminal to manually restart).

<details>
<summary>Manual env vars (if you'd rather set them yourself)</summary>

```
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_METRIC_EXPORT_INTERVAL=10000
```

</details>

## Project layout

```
src/
├── main/            # Electron main process
│   ├── db/          # SQLite client + schema + repos
│   ├── otel/        # OTLP receivers, decoders, aggregator
│   ├── economy.ts   # XP / Bits / level / spin rules
│   ├── notify.ts    # Coalesced renderer broadcast
│   ├── sprites.ts   # PixelLab-format sprite manifest builder
│   ├── ipc.ts       # ipcMain handlers
│   └── index.ts     # Entry — menubar setup, lifecycle, tray animation
├── preload/         # contextBridge surface (`window.codeling.*`)
├── renderer/        # React panel (Home / Shop / Stats)
└── shared/          # IPC contract types

assets/
├── sprites/<species>/    # Sliced sprite frames — one folder per species
│   ├── rotations/        # 8-direction (PixelLab) or south-only (sliced LuizMelo) static frames
│   └── animations/       # <name>/<direction>/frame_NNN.png — scanner aliases `idle`/`run`/etc.
├── sources/              # Raw unmodified source ZIPs preserved for re-extraction
│   ├── slime/            # rvros source + NOTICE.md
│   └── luizmelo/         # LuizMelo packs + NOTICE.md
└── tray-icon*.png        # Brand fallback when species sprite is missing

scripts/
├── install-telemetry.{ps1,sh}    # Per-platform env-var installers
├── install-stop-hook.mjs         # Claude Code Stop hook installer
└── luizmelo-slice.py             # LuizMelo spritesheet -> per-frame slicer

proto/                            # Vendored OTLP collector .proto files
```

## Adding a sprite

Two supported source flavors:

**PixelLab Character Creator exports.** Drop the unmodified export folder into `assets/sprites/<species>/`. The scanner reads PixelLab's native layout (rotations/ + animations/) — no renaming needed.

**LuizMelo itch.io packs.** Drop the unzipped pack into `assets/sprites/`, extend the `SPECIES` dict in `scripts/luizmelo-slice.py`, then run `python scripts/luizmelo-slice.py`. The slicer converts horizontal sprite strips into the PixelLab-compatible layout and archives the raw source under `assets/sources/luizmelo/`.

See [`sprites.md`](sprites.md) for the curated catalog of vetted open-source sprite candidates, license rules, and per-species frame inventory. See the *Sprite asset convention* and *Art pipeline* entries in `DIRECTION.md` for the canonical scanner behavior and pipeline decisions.

## Where things live

- **Vision, dated decisions, deferred backlog, open questions**: `DIRECTION.md`
- **Execution plan + per-milestone done/in-progress checklist**: `PLAN.md`
- **Human-only tasks** (asset generation, distribution, real-machine validation, playtesting): `HUMAN.md`
- **Sprite roster** (integrated species, license compatibility rules, scouting catalog, integration recipe): `sprites.md`
- **SQLite database** (runtime): `%APPDATA%\Codeling\codeling.db` on Windows, `~/Library/Application Support/Codeling/codeling.db` on macOS
- **Tunable game rules** (defaults): `src/main/economy.ts` (`ECONOMY_RULE_DEFAULTS`); live overrides live in the `meta` table and are editable via the Settings tab → Economy section

## Scripts

| Script | What |
|---|---|
| `npm start` | Forge dev — Vite HMR + Electron, hot-reloads main process on save (type `rs` to manually restart) |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `npm test` | Run vitest (pure-logic suites); `npm run test:watch` for watch mode |
| `npm run package` | Forge package — produces an unpacked binary |
| `npm run make` | Forge make — produces installers (Squirrel/DMG/DEB/RPM) in `out/make/` |
| `GITHUB_TOKEN=… npm run publish` | Forge publish — uploads installers to GitHub Releases as a draft (do not run lightly; cuts a release) |
| `npm run setup` | Same as `npx codeling install --skip-app` — telemetry + Stop hook only |
