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

### 2026-05-10 — Economy rates editable via meta table (M5 partial)
- **Rates live in `meta`, not a dedicated `economy_rules` table.** Reuses the existing key-value table with `economy:<rate>` prefix; no new schema, no migration. Defaults are baked into the code (`ECONOMY_RULE_DEFAULTS`); a missing meta row means "use the default", so users on older saves see the new editable surface immediately.
- **`getEconomyRules()` runs on every economy tick.** Cheap query (<10 rows of meta on average); avoids any cache-invalidation bug where a Settings edit doesn't propagate. The settings panel mutates DB directly, the next ingest tick reads fresh values.
- **`xpForLevel` stayed a function const, not editable.** The level-up *curve* is a structural design choice; per-rate tunables (XP per message, etc.) are content tuning. Different concerns. If players ever want a flatter or steeper curve, that's a separate setting (steepness multiplier) — not directly editing the formula.
- **Bounds enforced on the main side.** `ECONOMY_RULE_BOUNDS` is the source of truth; renderer mirrors via the IPC response so the input's `min`/`max` matches the validator. Matches the `SPIN_THRESHOLD_MIN/MAX` pattern but per-key.

### 2026-05-10 — Cosmetic equip + overlay composite (M2 partial)
- **Mutex by category, not slot.** `setEquipped` unequips all other cosmetics in the same category before equipping the new one. Slot-based mutex (head, eye, body) waits until art arrives with explicit slots — premature now with three placeholder cosmetics.
- **Overlay scan lives next to rotations/animations in the manifest.** `cosmetics/<id>/<direction>.png` mirrors the rest of the sprite layout. Stage-specific overrides work the same way (`stage_<N>/cosmetics/...`) thanks to the existing `speciesStageRoot` fallback.
- **Renderer picks direction with south fallback.** `cosmeticOverlays[id][direction] ?? cosmeticOverlays[id].south` — most cosmetics will only have south art for a while; rendering the south overlay even when the base is facing east is acceptable until per-direction art lands. Better than no overlay.
- **Float animation moved to the wrapper.** Previously `pet-sprite-idle` was on the single `<img>`; now it's on the stack `<div>` so base + overlays bob together. Avoids any chance of base-overlay desync.
- **No-op friendly.** Without any cosmetic PNG art on disk, equip toggle still works — just no visual change. The Shop "Equipped" badge confirms state. When art lands, it composites on next manifest fetch with no code change.

### 2026-05-10 — Daily summary (M5 partial)
- **Generic `meta (key TEXT PRIMARY KEY, value TEXT)` table** for app-level state that doesn't deserve a dedicated table. First user is `last_summary_date`. Future settings that don't fit the dedicated `pet`/`spin_state` rows can land here too — single-row config that's not part of any entity.
- **Idempotent fire** — `maybeShowDailySummary()` is called from both boot and ingest. Boot covers the case where the user opens the panel without sending a message; ingest covers the case where the app was running through midnight. The `last_summary_date == today` check makes both paths safe.
- **Skip empty days entirely.** No "0 messages yesterday" notifications, but we still mark the meta key so we don't re-evaluate every ingest tick. Dead-pixel cost (one extra meta write) vs the alternative of a noisy "you had no activity yesterday" surface.
- **Notification is `silent: true`.** Less obtrusive than the achievement chime — the user opted in to telemetry, the app shouldn't shout at them every morning. Still appears in the OS notification center for the user to discover at their pace.

### 2026-05-10 — Stop hook + supplementary tally (M3 partial)
- **Stop event is a per-turn end signal; OTEL `user_prompt` log is a per-turn start signal.** They normally come in pairs. Backfill is one-sided: `message_count = max(message_count, stop_event_count)` after each Stop. Means OTEL drops are caught at turn end (a few seconds late) without ever double-counting when OTEL is healthy.
- **Stop endpoint lives on the OTLP HTTP receiver, not a separate server.** Same port (4318), same Express app — fewer config knobs for the user, and the OTEL env-var installer already covered point-Claude-Code-at-the-receiver, so the URL is implicit. Distinct path namespace (`/codeling/...` vs `/v1/...`) keeps the two concerns clean.
- **`-m 2` curl timeout in the installed hook.** If Codeling isn't running, the hook shouldn't slow Claude Code's turn ending. 2 seconds is well under the noticeable threshold for completion latency. `-sS` keeps stderr noise off Claude's surface.
- **Cross-platform installer is one Node script, not two like telemetry.** JSON manipulation is too painful in raw bash + PowerShell. Settings.json editing benefits from a real JSON parser; node is already required (it's an Electron project), so we run our installer through it. Marker-based identification (substring match on the endpoint URL) keeps uninstall surgical even if the user adds their own Stop hooks alongside ours.
- **Backfilled messages run the full downstream pipeline.** If the Stop hook fills in a missed turn, we call `recordActivityToday` + `applyEconomy` + `evaluateAchievements` for the supplementary message — the player's XP/bits/streak/achievements should not be punished by an OTEL drop they didn't cause.

### 2026-05-10 — Auto-launch + save export/import (M5 partial)
- **Auto-launch state-of-truth lives with the OS, not in our DB.** Renderer reads via `app.getLoginItemSettings` → if the OS rejects a write (dev environment, missing entitlements), the next read returns the actual truth and the toggle reverts. No drift between what we think and what the OS does. Trade: setting takes effect only on the *next* login, not immediately, but that's the universal expectation for autostart toggles.
- **Save format is versioned + insertion-flexible.** `version` on every export. Import refuses higher versions; lower versions migrate forward by schema-discovery — for each table, `pragma table_info` gives current columns, and we filter the JSON row's keys against that set. Means an old save imported into a newer schema simply gets DEFAULT values for new columns; new save imported into an older app errors clean rather than corrupting state.
- **Import is atomic table-replace, not row-merge.** Cleaner mental model ("this save = this state") and avoids the design questions around merging timestamps / preferring one side. If a player wants merge-style sync that's a separate feature; export/import is for moving between machines, not collaborative state.
- **`otel_events` is excluded from the dump.** Event log is debug-only state; including it would balloon the JSON and isn't useful on the destination machine. Cleared on import so the destination's debug log starts fresh.

### 2026-05-10 — Daily streak (M5 partial)
- **Bucketed by local date, not UTC.** `localDateString()` builds `YYYY-MM-DD` from the user's wall clock. UTC bucketing would surprise a US user with a 4 PM "day rolled over" boundary. Tradeoff: streaks are slightly leaky across timezone changes (move from PST to JST → bucket shifts; rare in practice).
- **Streak counts back from today *or yesterday*.** A user's streak doesn't break the moment midnight passes — it stays "alive" until the user fails to log a message before the *following* midnight. Matches Snapchat/Duolingo expectations. Implemented as: if today has activity, start there; otherwise start at yesterday; otherwise streak is 0.
- **Activity is recorded on ingest, not separately**. Same pipeline that bumps message_count writes today's date row via INSERT OR IGNORE. No new IPC, no app-level tracking.
- **Streak surfaces in Snapshot for achievements**. Achievement defs (`streak_3` / `streak_7` / `streak_30`) read `s.streakDays`. Same evaluator pattern as the rest — no special-case streak machinery.

### 2026-05-10 — Achievements (M5 partial)
- **State-derived, not event-derived.** Every achievement has a `check(snapshot)` predicate that re-evaluates against the current totals. No "first message" event hook, no streak counter columns — just `SUM(message_count) FROM sessions >= 1`. Means resetSave clears them naturally; means new defs added later auto-evaluate against the existing save without backfill code.
- **One central evaluator, called from three sites.** `evaluateAchievements()` runs after applyEconomy (covers level/evolution/messages/cost), after performSpin (cosmetic-from-wheel), and after performPurchase (first-cosmetic, first-upgrade). Each call site is at the *boundary* of a state mutation, after the txn commits so listeners can't see partial state.
- **Boot-time silent backfill** prevents existing-save notification floods. First call at `bootstrap()` runs with `silent=true` — inserts every newly-eligible row but suppresses event emission. Future runtime evals emit normally. Pattern reusable for any future "added achievements/quests in v X" content drop.
- **Tier (bronze/silver/gold) drives both the OS notification body and the Stats UI accent.** Same approach as spin tiers — one categorical attribute, multiple presentation surfaces.
- **Reset wipes achievements.** Otherwise the player can't re-earn them after a save reset, which defeats the point. Reset is the only deletion path.

### 2026-05-10 — Settings panel (M5 partial)
- **Reset save is `DELETE * FROM <table> + seedDefaults` inside a single txn.** Extracted `seedDefaults` from `client.ts`'s init path so re-seeding doesn't duplicate logic. Atomic — if any DELETE throws, the user's save is intact. After-effects (`pet:reset` + `pet:renamed` events) fire *outside* the txn so tray refresh and tooltip update don't run while holding the SQLite write lock.
- **Spin threshold range constants live in `shared/types.ts`.** Same pattern as `PET_NAME_MAX_LENGTH` — single source for both `<input min/max>` validation in the renderer and the repo's range-check. Renderer keeps its own draft state so user edits don't lose focus while typing; commits on blur or Enter.
- **Telemetry off switch + XP/bit rate editing deferred.** "Off switch" needs receiver shutdown semantics (port lifecycle); rate editing needs `RULES` to be DB-backed instead of a const. Both are settings-panel scope creep — settings panel as shipped is small enough to ship now and unblocks balance playtesting (HUMAN.md).
- **`pet:reset` event added rather than overloading `pet:evolved` with a synthetic stage transition.** Tray subscribes to both to rebuild frames; honest event name beats clever payload.

### 2026-05-10 — Interim telemetry installer scripts (M3.1)
- **Two scripts, not one cross-platform Node CLI.** `.ps1` for Windows, `.sh` for macOS/Linux. Each is small, no dependencies, and exercises the platform-native mechanism users expect (PowerShell User-scope env vars vs. shell rc files). Bundled `npx codeling install` will eventually wrap these, but the scripts stand alone for early-stage installs.
- **POSIX writes a marked block, not loose lines.** `# >>> codeling-telemetry >>>` / `# <<< codeling-telemetry <<<` markers around the exports. Uninstall is a single `sed` deletion against the marker pair — surgical, never clobbers user edits to other rc lines. Same convention will apply to the future Stop-hook installer that writes into `~/.claude/settings.json`.
- **`sed -i.codeling.bak`** rather than bare `-i`. macOS BSD sed treats the next argument as the backup extension when `-i` has no value; specifying an explicit extension makes the same command portable to GNU sed too. Backup is removed immediately.
- **Conflict detection (Windows only) on `OTEL_EXPORTER_OTLP_ENDPOINT`.** If a user already has it pointed elsewhere (their own observability stack), we warn and bail unless `-Force`. POSIX equivalent: if you pass a non-default `ENDPOINT=...`, the block is written with that value — no implicit clobber because the rc-block approach respects whatever's already there until the script writes its own block.

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
- **Bundled `npx codeling install`** — the north-star install. The interim pieces are all shipped (`scripts/install-telemetry.{ps1,sh}`, `scripts/install-stop-hook.mjs`, Settings → Application auto-launch toggle); what's left is the assembly + `bin` setup that wraps them in one command and handles app download/launch + first-launch UX.

### Visuals — all art-blocked (HUMAN.md tracks asset tasks)
- **Species 2 & 3** — slime/blob and robot, all directions, all evolution stages.
- **Sprite layering for cosmetics** — code path shipped (manifest scans `cosmetics/<id>/<direction>.png`, equip toggle in Shop, overlay render in PetSprite). No-op until overlay PNG art lands.
- **8-directional idle / animation frames** — manifest scans them; renderer + tray currently use south-only. Pick a behavior (face-direction-of-last-XP-source? camera follow?) once the rest stabilizes.
- **Starter selection animation** — silhouette reveal on first launch. Blocked on species 2/3 art.

### Distribution (M4)
- Code signing (macOS notarization, Windows Authenticode) — needs paid certs, HUMAN.md tracks
- Auto-updates (Squirrel.Mac / Squirrel.Windows via Forge)
- DMG / MSI / Squirrel installer outputs
- Homebrew tap, scoop manifest, winget submission

### Settings leftovers
- **XP / bit rate editing** — needs `RULES` → DB-backed refactor before exposing in the Settings panel.
- **Telemetry on/off switch** — receiver port lifecycle (start/stop without restarting the app). Spec out before building.

---

## Open questions

- **Cumulative vs delta resilience** — aggregator now skips CUMULATIVE-temporality metrics with a warning rather than ballooning. Proper handling (per-(session, field) cumulative state for delta derivation) is still open if Claude Code switches.
- **Multi-machine** — does a user expect their pet to follow them between machines? Implies cloud sync, which implies an account. Default answer: no, local-only, but worth revisiting. Save export/import covers manual migration in the meantime.
- **Hook loop risk** — a Stop-hook installer that calls back into Codeling's HTTP receiver could create a loop if Codeling itself ever invokes `claude`. Worth a guard (skip telemetry when `CLAUDE_CODE_ENTRY_POINT` indicates a self-call). Premature until something actually spawns `claude`.
- **Sprite manifest fetched 3× per panel mount.** Observed 2026-05-10: `[sprites] wizard stage 0: ...` logs three times on app boot. PetSprite calls `getSprites` for animations, Home calls it again for the background URL, and React StrictMode dev-double-mounts add a third. Each call rescans the disk + builds the manifest. Cheap to fix — either cache in the renderer (React context or a tiny module-level promise dedupe) or in the main-process scanner (memoize by `species:stage`). Not user-visible, but wasteful and grows linearly with future getSprites callers. Pick a layer before the next renderer feature lands.
