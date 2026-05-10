# Codeling — Direction & Decisions

A living doc. Append entries with a date stamp. Read top-to-bottom before starting non-trivial work — newer entries can supersede older ones.

---

## Vision (north star)

A gamified pet companion for Claude Code users. Tray/menu-bar app on macOS + Windows. The more you use Claude Code, the more your pet grows.

**End-state install flow** (not built yet — see *Deferred*):
```
npx codeling install
```
Should do everything in one shot:
1. Install the app (or download a prebuilt binary)
2. Set the OTEL env vars persistently at user scope so every Claude Code invocation feeds the receiver
3. Register Codeling to auto-launch at login
4. Optionally install the Stop hook in `~/.claude/settings.json`
5. Open the panel and play the starter-reveal animation

The user should not have to think about ports, env vars, OTEL protocols, or hooks. "Install it, use Claude Code, watch the pet grow."

---

## What's wired up today

- **Stack**: Electron Forge + Vite + TypeScript + React 18, `menubar` for tray, `better-sqlite3` for local store
- **OTLP receivers**: HTTP on `127.0.0.1:4318` and gRPC on `127.0.0.1:4317` (both run; user can use either)
- **Aggregator** (`src/main/otel/aggregator.ts`): walks decoded payloads → `claude_code.token.usage` (DELTA) → token columns; `event.name=user_prompt` → message_count
- **Economy** (`src/main/economy.ts`): user messages + output tokens → XP/Bits, level-ups carry XP forward, spin granted every N messages
- **Live updates**: ingest broadcasts `codeling:update` → renderer refetches Home/Stats automatically
- **UI**: 3 tabs (Home / Shop / Stats); Home shows pet sprite + level/XP/bits + spin progress

---

## Decisions log

### 2026-05-09 — Greenfield scaffold choices
- **Build**: Electron Forge + `@electron-forge/plugin-vite` over `electron-vite`. Forge is officially supported by the Electron team and bundles packaging.
- **Language**: TypeScript everywhere — strong IPC contracts matter once main/preload/renderer start passing rich game state.
- **DB**: `better-sqlite3` (synchronous, fastest). Marked external in main Vite config; ASAR unpacks `*.node`. Native rebuild handled by Forge's prepare-deps step on `npm start`.
- **Tray library**: `menubar` v9.5.x — same package handles macOS menu bar and Windows system tray, no fork needed.

### 2026-05-09 — Support both OTLP transports (4317 + 4318)
Original spec said gRPC/4317, but no off-the-shelf pure-Node OTLP receiver exists. HTTP/4318 cuts the receiver code by ~90% (just Express + protobufjs). Decision: ship both so users can point Claude Code at either; HTTP is the recommended default.

### 2026-05-09 — Vendor OTLP `.proto` files into `proto/`
Pulled from `open-telemetry/opentelemetry-proto` v1.3.2. Both receivers share the same proto root (`@grpc/proto-loader` for gRPC, `protobufjs` for HTTP). Packaged via Forge `extraResource: ['./proto']`.

### 2026-05-09 — Forge Vite output filename collision
Both main and preload entries are `index.ts`, which would write to `.vite/build/index.js` and overwrite each other. Forced output names via `build.rollupOptions.output.entryFileNames` in each Vite config.

### 2026-05-10 — OTLP→sessions aggregation rules
Confirmed by inspecting real Claude Code emissions:
- Metric names use `claude_code.*` prefix; `claude_code.token.usage` has `type` attribute with values `input | output | cacheRead | cacheCreation` — maps 1:1 to schema columns.
- All Claude Code metrics use `AGGREGATION_TEMPORALITY_DELTA` → aggregator always **adds**, never sets.
- `session.id` lives in **data point attributes** (not resource attributes). Resource only has host/os/service.
- For logs, `event.name=user_prompt` is the canonical "user sent a message" event. Body is `claude_code.user_prompt`. Counted as +1 to `message_count`.
- Other events (`api_request`, `mcp_server_connection`, etc.) currently bump `last_seen_at` only.

### 2026-05-10 — Default starter is wizard
Until species 2 (slime) and 3 (robot) art exists, `pet.species` seeds to `wizard` so the bundled south-facing sprite renders. Random starter assignment + silhouette reveal is deferred until all 3 species have art.

### 2026-05-10 — Economy v0 rules
Single source of truth: `RULES` in `src/main/economy.ts`.
- 10 XP per user message
- +1 XP per 100 output tokens
- 5 bits per user message
- +1 bit per 1000 output tokens
- Level threshold = `level × 100` XP (linear; carries XP forward on level-up)
- Spin every 50 user messages (`spin_state.spin_threshold` in DB, configurable per-pet)

These are placeholders. Tune after watching real session data accumulate.

### 2026-05-10 — Sprite asset convention (PixelLab-native)
Drop a PixelLab Character Creator export as-is into `assets/sprites/<species>/`. The scanner (`src/main/sprites.ts`) consumes the native PixelLab layout:

```
assets/sprites/wizard/
├── rotations/
│   ├── south.png           # canonical static fallback
│   ├── north.png, east.png, ...
│   └── north-east.png      # hyphenated 8-dir names
├── animations/
│   ├── Breathing_Idle-3c8dc0f6/
│   │   └── south/frame_000.png ...
│   └── Running-c929152c/
│       └── south/frame_000.png ...
└── metadata.json           # ignored
```

Animation folder names are normalized: `-<hash>` suffix stripped, lowercased, plus aliases for common keywords — `Breathing_Idle` → exposes both `breathing_idle` and `idle`; `Running` → `running` + `run`. So `<PetSprite animation="idle">` resolves to whichever folder contains "idle" or "breath".

Direction names accepted: full (`north`), short (`n`), and hyphenated (`north-east`) — all map to the canonical 8-direction enum.

Backwards-compat: also reads the simpler flat layout `<animation>/<direction>_<frame>.png` if a species folder is set up that way (no PixelLab export).

Manifest also exposes `animations.static` — a 1-frame "animation" per direction sourced from `rotations/`, so renderers can request a still pose by direction without special-casing. Console logs a one-line summary on every scan.

### 2026-05-10 — Live UI via `codeling:update` IPC broadcast
Rather than polling, ingest pushes a debounced `codeling:update` to all windows. Renderer hooks subscribe via `window.codeling.onUpdate(cb)` and refetch their slice of state. Coalesced with `setImmediate` so a burst of OTLP signals = one renderer refresh.

### 2026-05-10 — Multi-species scaffolding (M2 partial)
- **Pet rename uses an event, not the broadcast channel, for the tray tooltip.** `pet:renamed` on the in-process emitter; tray subscribes and calls `tray.setToolTip()`. Renderer-broadcast `codeling:update` already fires for the panel refresh — keeping tray-tooltip plumbing on the main-process emitter avoids reading the DB on every renderer-update tick (most don't change the name).
- **Per-species `TRAY_HEAD_FRACTION` is a small flat record, intentionally not a per-stage thing.** Stage rarely changes the silhouette enough to warrant per-stage tuning; if it does (e.g., wizard stage 3 grows wings), introduce a per-(species, stage) map then. Premature for now — three flat values cover the planned roster.
- **`PET_NAME_MAX_LENGTH` lives in `shared/types.ts` so renderer and main share the cap.** Repo enforces it; renderer's `<input maxLength>` plus inline validation give immediate feedback. Errors round-trip as discrete codes (`empty-name` / `name-too-long`) — not human-readable strings — so the renderer owns localization later.

### 2026-05-10 — Pet-stage scenery (M1.5)
- **Background lives in the manifest, not as a separate IPC.** `SpriteManifest.background` is populated by `findBackground` during the same scan that builds rotations/animations. Renderer fetches once per `(species, stage)` change. Keeping it in the manifest means future per-stage scenery (apprentice → archmage tower) lands automatically without touching the renderer.
- **Stage-specific scenery wins over species default.** `assets/sprites/<species>/stage_<N>/background.png` overrides `assets/sprites/<species>/background.png`. Mirrors the rotations/animations precedence rule — same mental model across all PNG kinds.
- **Renderer applies `image-rendering: pixelated`** so PixelLab pixel-art scenery doesn't get blurry-resampled when the stage is wider than the source PNG. `background-size: cover; background-position: center bottom;` so the floor of the scene anchors correctly even at non-1:1 aspect ratios.

### 2026-05-10 — Shop + first upgrade (M1.4)
- **Shop cosmetic ids reuse `unlocks.item_id` keyspace.** A cosmetic obtained via the wheel and the same cosmetic listed in the shop are the *same row* — `INSERT OR IGNORE` plus the upfront `already-owned` check both protect against double-acquisition. This means wheel-only and shop-only cosmetics can co-exist without a separate "purchasable from shop" flag; the catalog is just a subset of the COSMETICS registry.
- **Upgrades go through the same `unlocks` table with `category='upgrade'`.** Cheap unified ownership query (`SELECT FROM unlocks WHERE item_id = ?`). `bit_multiplier_2x` sets the pattern: economy reads ownership inside its txn — purchase that lands mid-batch is consistent for that ingest tick. When upgrade count grows, factor out an `applyMultipliers` helper rather than chaining ifs.
- **Single Shop list per tab, merged.** Catalog rows + owned-but-not-in-catalog rows render in one stream so wheel-only cosmetics show up in the shop view (as "Owned") without a separate section. Avoids the "where did my unlocks go" UX bug from the M1.1 split layout.
- **Distinct error codes from `performPurchase`** (`unknown-item` / `insufficient` / `already-owned`) so the renderer can show specific messages — even though the UI gates the button proactively, the error path is hit on any race (e.g., bits dropped via concurrent economy tick after render but before click).

### 2026-05-10 — Cost tracking (M1.3)
- **`claude_code.cost.usage` is DELTA + `as_double`**, single scalar per data point with no `type` attribute. Same metric pipeline as token usage — adds a fourth `SessionField` (`cost_usd`) and threads through `applySessionOps` unchanged thanks to the parameterized `field` interpolation already in place. Repo `VALID_FIELDS` allow-list extended so the dynamic field name interpolation stays injection-safe.
- **Schema migration via probe-then-ALTER.** SQLite has no `ADD COLUMN IF NOT EXISTS`, and `db.exec(schema)` only runs `CREATE TABLE IF NOT EXISTS` which won't add columns to a pre-existing table. New `runMigrations()` in `client.ts` uses `pragma table_info` to detect missing columns and issues `ALTER TABLE ADD COLUMN` idempotently. Pattern is reusable for future column additions.
- **Currency display uses sub-penny precision.** `Intl.NumberFormat({style:'currency', maximumFractionDigits: 4})` — early sessions are tiny enough that 2dp would render as `$0.00`. Once the totals are routinely in the dollars range, can drop back to 2dp.

### 2026-05-10 — Evolution model (M1.2)
- **Stage is derived state, not earned credit.** `applyEconomy` recomputes the target stage from `SUM(output_tokens)` across the `sessions` table on each ingest tick and writes back the max of (current, target). Monotonic — you never devolve. This means a player can manually reset `pet.evolution_stage = 0` and it'll re-advance on the next economy tick, which is the desired behavior for save migrations.
- **Cumulative pulled inside the same SQLite txn that updates the pet row** so the read can't observe partial state across concurrent reads (single-threaded today, but the txn boundary is correct regardless).
- **Sprite per-stage layout: `assets/sprites/<species>/stage_<N>/`** mirrors the root layout (rotations/, animations/). Manifest scanner falls back to species root when the stage subdir is absent — so a freshly-evolved pet without dedicated art stays visible as the previous form rather than a broken image. Stage 0 always lives at species root by convention; renderers passing `stage=0` get the existing layout untouched.
- **Cross-module tray refresh via a singleton EventEmitter (`src/main/events.ts`)** rather than direct coupling between economy → tray. `applyEconomy` emits `pet:evolved` *outside* its txn (no SQLite write-lock held during listener execution); `index.ts` subscribes and rebuilds the static + animated tray frames for the new stage. This keeps the renderer-broadcast `codeling:update` channel separate from in-process main signals.

### 2026-05-10 — Spin reward shape (M1.1)
- **Single weighted catalog, three reward kinds.** `bits` / `xp` / `cosmetic`. No `multiplier` kind yet — defers until shop upgrades land in M1.4 so the multiplier-stacking semantics get designed in one place rather than retrofitted.
- **Tiers (`common`/`uncommon`/`rare`/`legendary`) drive both UI and consolation amounts.** Visual treatment in the toast and in the Shop's "Owned" list keys off `tier`. When a cosmetic roll lands on something the pet already owns, the player gets `CONSOLATION_BITS[tier]` instead — duplicate-protection that scales so a duplicated legendary still feels meaningful.
- **`COSMETICS` is the cosmetic registry, separate from the reward draw table.** Reward defs reference cosmetics by `cosmeticId`; the registry maps `cosmeticId` → `{ label, tier }`. The `unlocks` table stores `item_id = cosmeticId`. `getUnlocks()` resolves through the registry, so Shop labels survive cosmetic rebalances and renames live in one place.
- **Atomicity via single SQLite txn in `performSpin()`.** Decrement spins_available → draw → mutate pet/unlocks → return. PRIMARY KEY conflict on duplicate cosmetic detected via `INSERT OR IGNORE` + `changes === 0`. No partial state if anything throws.
- **Spin handler broadcasts `codeling:update`.** Same channel ingest uses, so Home re-fetches pet (bits/level/xp) and Shop re-fetches unlocks without a separate IPC.

---

## Deferred / backlog

Roughly ordered by impact for the next iteration.

### Onboarding
- **`npx codeling install` flow** — the north-star install. Should:
  - Install/launch the app
  - Set OTEL env vars persistently (Windows: `[Environment]::SetEnvironmentVariable(..., "User")`; macOS/Linux: marked block in `~/.zshrc` or `~/.bashrc`)
  - Optionally install Stop hook to `~/.claude/settings.json`
  - Register auto-launch on login
- **Until then**: ship a `scripts/install-telemetry.{ps1,sh}` that just handles the env-var step. Documented as a temporary workaround.

### Game loop
- **Achievements / streaks** — daily streak, lifetime totals milestones

### Visuals
- **Per-character pet-stage backgrounds** — give each species a default scene behind the sprite in the Home tab stage area (e.g., wizard tower/spellbook, slime forest, robot lab). Right now the stage is a flat dark purple panel. Suggested layout: `assets/sprites/<species>/background.png` consumed by the manifest scanner; `<PetSprite>` parent renders it as a CSS `background-image`. Make backgrounds optional so it's a graceful fallback when missing. Future: shop-purchased backgrounds layer on top of (or replace) the species default — same slot, different source.
- **Real PixelLab wizard sprite** — done; PixelLab export landed at `assets/sprites/wizard/`
- **Species 2 & 3** — slime/blob and robot, all directions, all evolution stages
- **Sprite layering for cosmetics** — accessory PNGs composited over base sprite
- **8-directional idle / animation frames** — currently south-only idle plays at 6 FPS in panel and 4 FPS in tray. Other directions (and walk/attack) are scanned into the manifest but unused.
- **Starter selection animation** — silhouette reveal on first launch (only after all 3 species have art)
- **Per-species tray crop tuning** — `processForTray` currently uses 0.55 (top 55%) head-crop tuned for humanoid wizard. Slime/robot likely want different fractions or no crop. Add `TRAY_HEAD_FRACTION: Record<Species, number>` when those species land.

### Stop hook
- Installer that adds Codeling's local endpoint to `~/.claude/settings.json` `hooks.Stop`
- Receiver endpoint in main process that ingests Stop hook payloads as a supplementary message tally (cross-check against `user_prompt` log events to catch dropped OTEL data)

### Distribution
- Code signing (macOS notarization, Windows Authenticode)
- Auto-updates (Squirrel.Mac / Squirrel.Windows via Forge)
- DMG / MSI / Squirrel installers
- Homebrew tap, scoop manifest, winget submission

### Settings / persistence
- User-editable settings panel: spin threshold, XP/bit rates, telemetry on/off
- Pet rename UI
- Cosmetic equip toggle
- Reset / export / import save

---

## Open questions

- **Cumulative vs delta resilience** — aggregator currently assumes all token metrics are DELTA. If Claude Code ever switches to CUMULATIVE temporality, totals will balloon. Add a temporality check + branch before that becomes a real risk.
- **Multi-machine** — does a user expect their pet to follow them between machines? Implies cloud sync, which implies an account. Default answer: no, local-only, but worth revisiting.
- **Hook loop risk** — a Stop-hook installer that calls back into Codeling's HTTP receiver could create a loop if Codeling itself ever invokes `claude`. Worth a guard (skip telemetry when `CLAUDE_CODE_ENTRY_POINT` indicates a self-call).
- **OTEL endpoint conflicts** — if a user already has `OTEL_EXPORTER_OTLP_ENDPOINT` set for another purpose (their own observability stack), Codeling shouldn't clobber it. Detect on install and prompt.
