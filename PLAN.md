# Codeling — Execution Plan

Tactical companion to `DIRECTION.md`. Where DIRECTION captures *why* (vision, decisions, rationale), PLAN captures *what + when + in what order*. Update after every commit: tick boxes, move items between sections, append to *Risks* if something surprising lands.

---

## Snapshot

Game loop is live end-to-end. Launch with `npm start`, point Claude Code at `localhost:4318` (use `scripts/install-telemetry.{ps1,sh}` to set the env vars User-scope), and watch:
- Stats tab populates with sessions / message_count / input+output tokens / cost as Claude Code emits OTEL
- Home tab fills the XP bar, accumulates bits, ticks down "Spin available in N messages", and shows a "N-day streak" pill once activity is recorded
- Spin button delivers a tier-styled reveal toast (bits / xp / cosmetic with consolation-bits dedupe), wheel + shop + equip / unequip all wired
- Evolution stages advance monotonically on cumulative output tokens; tray + panel sprites pick up `stage_<N>/` art when present
- Achievements fire via OS notifications (16 defs across engagement / progression / evolution / collection / cost / streak)
- Settings panel edits spin threshold + economy rates + launch-on-login + save export/import + reset save
- Daily summary fires once per local day with "N sessions · M messages · $X.XX" body

Sprite roster now 14 species with art (PixelLab wizard + rvros slime + 12 LuizMelo CC0 creatures), all integrated and visually verified end-to-end. See `sprites.md`.

What's still ahead: bundled `npx codeling install` (interim per-platform scripts shipped), robot species art (David Harrington CC0 candidate, not yet pulled), code signing + distribution channels, UX polish (popout window, spin reveal animation, customize tab — see DIRECTION.md → Deferred / UX polish).

Repo: https://github.com/tdodd777/Codeling · main branch tracking origin · run `npm test` for vitest pure-logic suites.

---

## Done

### Scaffold (M0)
- [x] Electron Forge + Vite + TypeScript + React 18 project structure
- [x] `menubar` cross-platform tray (380×560 panel, 3 tabs: Home/Shop/Stats)
- [x] `better-sqlite3` store with schema + seed (`src/main/db/schema.sql`, `client.ts`, `repos.ts`)
- [x] Vendored OTLP `.proto` files under `proto/`
- [x] OTLP/HTTP receiver on `127.0.0.1:4318` (Express + protobufjs)
- [x] OTLP/gRPC receiver on `127.0.0.1:4317` (`@grpc/grpc-js` + proto-loader)
- [x] Forge Vite output filename collision fix (forced `main.js` + `preload.js`)
- [x] Asset placeholders + tray icon fallback chain

### Game pipe (M0.5)
- [x] OTLP → `sessions` aggregator (`src/main/otel/aggregator.ts`): `claude_code.token.usage` by `type` → token columns; `event.name=user_prompt` log → `message_count`
- [x] DELTA-temporality additive upsert with `applySessionOps` transaction
- [x] Economy module (`src/main/economy.ts`): XP / Bits per message + per output-token; level-up with carryover; spin granted every 50 messages
- [x] `codeling:update` IPC broadcast (debounced via `setImmediate`); Home + Stats subscribe and refetch live

### Visuals (partial)
- [x] PixelLab-format sprite manifest scanner (`src/main/sprites.ts`) — `rotations/` + `animations/<name>-<hash>/<dir>/frame_*.png`, animation-name aliasing (`Breathing_Idle` → `idle`)
- [x] `<PetSprite>` cycles idle frames at 6 FPS; falls back to static south
- [x] Tray icon follows pet species — auto-cropped to content, head-cropped to 55%, animated at 4 FPS via `mb.tray.setImage`

### Project hygiene
- [x] Git initialized + pushed to https://github.com/tdodd777/Codeling
- [x] `DIRECTION.md` (decisions log + backlog) and `README.md` (developer-facing) in place
- [x] `.gitignore` covers `node_modules/`, `.vite/`, `out/`, `*.db`, `.env`

### M1.1 — Spin wheel logic
- [x] Spin reward catalog (`src/main/spin/rewards.ts`): bits/xp/cosmetic with tier + weight; cosmetic registry (`COSMETICS`) keyed by `unlocks.item_id`; consolation bits per tier
- [x] Weighted draw helper (`drawReward`) with injectable RNG
- [x] IPC `codeling:spin()` — atomic txn decrements `spins_available`, draws reward, applies effect; duplicate cosmetic falls back to consolation bits
- [x] `getUnlocks()` repo + `codeling:getUnlocks` IPC; spin handler calls `notifyUpdate()` so Home/Shop refresh
- [x] Home tab wires the button; tier-styled reveal toast (backdrop, click-or-3.5s dismiss); Shop "Owned" section renders cosmetics with rarity accent

### M1.2 — Evolution thresholds
- [x] Per-species `EVOLUTIONS: Record<Species, number[]>` cumulative output-token thresholds + `stageForOutputTokens` helper (`src/main/evolution.ts`)
- [x] `applyEconomy` queries `SUM(output_tokens)` across sessions, bumps `pet.evolution_stage` (monotonic), surfaces `evolved`/`newStage` in result
- [x] Sprite layout: `assets/sprites/<species>/stage_<N>/` overrides root when present (graceful fallback for stages without art)
- [x] `<PetSprite>` accepts `stage`; Home passes `pet.evolutionStage`; `getSprites` IPC takes optional stage
- [x] Main-process EventEmitter (`src/main/events.ts`) emits `pet:evolved`; index.ts subscribes and rebuilds tray frames (and static icon) for the new stage
- [x] ingest.ts logs `evolved=stage_N` alongside econ summary

### M1.3 — Cost tracking
- [x] `sessions.cost_usd REAL NOT NULL DEFAULT 0` in schema; idempotent migration in `client.ts` (probes `pragma table_info` then `ALTER TABLE ADD COLUMN`)
- [x] Aggregator handles `claude_code.cost.usage` (DELTA, `as_double`) — no `type` attribute, single scalar per data point routed to `cost_usd` field; repo `VALID_FIELDS` allow-list extended
- [x] `LifetimeStats.totalCostUsd` summed in `getLifetimeStats`; Stats tab renders a "Cost" row formatted via `Intl.NumberFormat('en-US', {style:'currency'})` (up to 4 decimals so sub-penny totals don't read as $0.00)
- [x] ingest.ts log shows `+cost_usd=$X.XXXX` alongside other deltas

### M1.4 — Minimum viable shop
- [x] Shop catalog (`src/main/shop/catalog.ts`): 2 cosmetics (`glasses` 100 bits, `witch_hat` 250 bits) + 1 upgrade (`bit_multiplier_2x` 500 bits, permanent). Cosmetic shop ids reuse `unlocks.item_id` so dedupe with wheel rewards is automatic.
- [x] `performPurchase` atomic txn (`src/main/shop/index.ts`) — checks bits, decrements, inserts unlock; distinct error codes: `unknown-item` / `insufficient` / `already-owned`
- [x] IPC `codeling:purchase` + `codeling:getShopItems`; broadcasts `codeling:update` on success
- [x] `applyEconomy` checks `unlocks` for `bit_multiplier_2x` inside its txn and doubles `bitsGained` if owned
- [x] Shop tab redesigned: header with "N bits" balance, single per-tab list combining catalog items and owned-not-in-catalog (wheel rewards still appear). Inline buy button, disabled when broke or pending. Per-row success/error feedback with auto-dismiss.

### M1.5 — Per-character pet-stage background
- [x] `SpriteManifest.background?: string` populated by `findBackground` in `src/main/sprites.ts` — prefers `assets/sprites/<species>/stage_<N>/background.png`, falls back to `assets/sprites/<species>/background.png`
- [x] Home tab fetches manifest by `(species, stage)`, applies `background-image` + `background-size: cover` to `.pet-stage` only when present (`pet-stage--scenic` modifier); refetches on evolution
- [x] `image-rendering: pixelated` on the scenic stage so PixelLab scenery stays crisp
- [ ] **Asset task** (HUMAN.md): drop a `background.png` into `assets/sprites/wizard/` — without it, stage stays flat purple as before

---

## In progress

_Nothing currently mid-flight._

---

## M1 — Game loop alive (next up)

Goal: every visible UI element does something real. After M1, the app is a complete (if minimal) game.

---

## M2 — Multi-species + visual polish

Code-only items shipped; species roster has expanded well beyond the original 3-species spec via the LuizMelo CC0 catalog (see `sprites.md`).

- [x] Slime species (rvros CC0 — single-direction idle + run, `assets/sprites/slime/`)
- [ ] Robot species → `assets/sprites/robot/` — David Harrington CC0 robot is the candidate, see `sprites.md`
- [x] **Bonus** — 12 LuizMelo creatures shipped via `scripts/luizmelo-slice.py`: flying_eye, bat, mimic, evil_wizard, fire_worm, martial_hero, martial_hero_2, apprentice_wizard, goblin, skeleton, mushroom, rat. All CC0, all visually verified.
- [x] Per-species `TRAY_HEAD_FRACTION: Record<Species, number>` (`src/main/index.ts`): now 15 entries covering all integrated species + the robot placeholder. `processForTray(img, species)` reads the fraction; per-species values for the LuizMelo roster are placeholders to tune as each is observed on a real tray.
- [ ] First-launch starter randomizer (replace hardcoded `wizard` seed). Slime + LuizMelo roster art exists; need to decide which subset of the 14 art-shipped species rotate as starters vs. unlockable via other paths.
- [ ] Silhouette reveal animation on starter assignment — **blocked on starter randomizer**
- [x] Pet rename UI: click `pet-name` on Home → inline input (`PetNameEdit` in `Home.tsx`); IPC `codeling:renamePet(name)` validates 1-`PET_NAME_MAX_LENGTH` chars trimmed, returns distinct `empty-name`/`name-too-long` error codes. Tray tooltip updates via new `pet:renamed` event.
- [ ] Other-direction sprite usage: stage shows pet facing toward whichever side made it gain XP last? (TBD — pick something fun)
- [x] Cosmetic equip/render code path: `setEquipped` IPC mutex'd by category (one cosmetic at a time for now); manifest scans `cosmetics/<id>/<direction>.png` (with stage_N override + south fallback); `<PetSprite>` composites overlays as absolute-positioned imgs over the base. No-op until overlay PNGs land in `assets/sprites/<species>/cosmetics/<id>/`. Shop replaces "Owned" pill on cosmetics with an Equip/Equipped toggle. Float animation moved to wrapper so base + overlays move in sync.

---

## M3 — Onboarding (the `npx codeling install` story)

This is the make-or-break adoption flow. Build it once the game is fun enough to be worth installing.

- [x] Telemetry env-var installer (interim): `scripts/install-telemetry.{ps1,sh}` with install/uninstall/status modes — sets per-User OTEL env vars (Windows: `[Environment]::SetEnvironmentVariable(..., "User")`; POSIX: marked block in `~/.zshrc` / `~/.bashrc`). Conflict detection on existing `OTEL_EXPORTER_OTLP_ENDPOINT` (warn unless `-Force`/matching ENDPOINT). README updated; real-machine smoke tests tracked in HUMAN.md.
- [x] Stop hook installer: `scripts/install-stop-hook.mjs` (Node ESM, cross-platform) edits `~/.claude/settings.json` to add a curl-based Stop hook tagged with a marker URL; uninstall filters by marker. `npm run stop-hook:{install,uninstall,status}` for ergonomics. Receiver: `POST /codeling/stop-hook` on the existing HTTP receiver routes to `handleStopHook` which bumps `sessions.stop_event_count` and backfills `message_count` if it lagged — driving the same downstream pipeline (economy / streak / achievements / panel push) as OTEL would have.
- [ ] Auto-launch on login: Electron's `app.setLoginItemSettings` on macOS, registry write on Windows
- [ ] Bundle everything into a single `npx codeling install`:
  - Download / build the app
  - Run telemetry installer
  - Run Stop hook installer (with consent prompt)
  - Register auto-launch
  - First-launch UX: starter reveal animation kicks in
- [ ] Conflict detection: if user already has `OTEL_EXPORTER_OTLP_ENDPOINT` set, prompt before overwriting
- [ ] Self-call guard: skip Codeling's own telemetry when `CLAUDE_CODE_ENTRY_POINT` indicates a Codeling-spawned `claude` invocation (avoid loop)

---

## M4 — Distribution

- [ ] Code signing
  - macOS: Developer ID + notarization
  - Windows: Authenticode certificate (could defer with smartscreen warning for early users)
- [ ] Forge `make` configs for installers: Squirrel.Windows, Squirrel.Mac DMG, DEB/RPM
- [ ] Auto-update via Squirrel
- [ ] Distribution channels: GitHub Releases (free), Homebrew tap (`brew install --cask codeling`), Scoop manifest, winget submission
- [ ] Versioning + changelog convention (semver + Keep a Changelog format?)

---

## M5 — Polish

- [x] Settings panel (4th tab):
  - Spin threshold inline numeric input (`SPIN_THRESHOLD_MIN`–`SPIN_THRESHOLD_MAX` range; commit on blur/Enter; per-row error)
  - Receiver section: read-only HTTP/gRPC endpoints + pointer to install scripts
  - Danger zone: Reset save (atomic txn wipes pet/sessions/unlocks/spin_state/otel_events/achievements, re-seeds defaults, fires `pet:reset` + `pet:renamed` so tray refreshes)
  - **XP/bit rate edits shipped.** `RULES` refactored: `xpPerMessage`/`xpPerOutputTokens`/`bitsPerMessage`/`bitsPerOutputTokens` live in the `meta` table under the `economy:` prefix; defaults apply when no override is set. Settings → Economy section edits each value with bound-checked input + reset-to-defaults. `applyEconomy` calls `getEconomyRules()` per tick so live edits take effect without restart. `RULES.xpForLevel` (the level-up curve formula) stays a const — not user-editable.
  - Deferred: telemetry off switch
- [x] Achievements (state-derived milestones):
  - `src/main/achievements.ts` — 16 defs across engagement / progression / evolution / collection / cost / streak tiers; each `check`s a Snapshot built from sessions + pet + unlocks + streak
  - `achievements (id, earned_at)` table; `evaluateAchievements()` is called after applyEconomy / performSpin / performPurchase
  - Boot-time silent backfill so existing saves don't flood notifications on first ingest tick
  - OS notification per newly-earned achievement (tray balloon via `Notification`)
  - Stats tab renders earned + locked groups with tier-keyed left-border accent (bronze/silver/gold)
- [x] Daily streak: `daily_activity (date TEXT PK)` table bucketed by local date. `recordActivityToday` from ingest when `message_count > 0`; `getCurrentStreak` walks back from today (or yesterday — streak still alive) until a missing day. `streak_3` / `streak_7` / `streak_30` achievements; "N-day streak" pill on Home tab.
- [x] Auto-launch on login: Settings → Application toggle wraps `app.setLoginItemSettings`. Reflects OS-stored truth via `getLoginItemSettings` so dev environments where the call no-ops surface as "didn't take" feedback.
- [x] Export / import save: Settings → Save buttons. JSON dump (versioned, schema = `{ version, exportedAt, pet, sessions, unlocks, spin_state, achievements, daily_activity, meta }`). Import is a single atomic txn: clear all + insert by table+column with unknown-column filtering, re-seed defaults afterward. `pet:reset` + `pet:renamed` events fire so tray refreshes for the imported pet.
- [x] Daily summary notification: `meta` key/value table tracks `last_summary_date`. `maybeShowDailySummary()` is idempotent — fires from boot + first ingest of each local day. Body: "N sessions · M messages · $X.XX" (cost segment hidden when zero). Skips empty days entirely. `silent: true` notification (less obtrusive than achievement chime).
- [ ] Multi-machine sync (only if there's user demand — implies an account/server)

---

## Risks / known issues

DIRECTION.md → *Open questions* is the durable list. Items below are PLAN-scoped operational risks; cross-link to DIRECTION for the architectural / design ones (cumulative-vs-delta resilience, multi-machine sync, hook loop risk, sprite manifest triple-scan, stop-hook vs OTEL ordering race).

- **Windows tray icon size cap.** Even with the head-only crop + 40px source, the tray slot is still small relative to text-only icons. May need a per-species redesign (just hat + face emoji-style) if it stays unreadable. Not a code problem — an asset problem.
- **better-sqlite3 native rebuild.** Forge handles this via `npmRebuild` on `npm start`. If a teammate hits ABI mismatch errors, the fix is `npx electron-rebuild -f -w better-sqlite3`. Document this in README troubleshooting once it bites someone.
- **Pure-logic tests landed (vitest); DB-touching code still untested.** `evolution.test.ts`, `spin/rewards.test.ts`, `streaks.test.ts` cover the deterministic logic. OTLP→sessions pipe + economy + achievements + stop-hook still need integration tests against a `:memory:` SQLite — blocked on small refactor of `getDb()` to accept a path / use an env override.
- **Tray animation CPU cost.** `setInterval` at 4 FPS swapping pre-rendered images is cheap, but on battery it adds up. Consider pausing animation when system idle (`powerMonitor.on('suspend' | 'lock-screen')`).
