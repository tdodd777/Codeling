# Codeling — Execution Plan

Tactical companion to `DIRECTION.md`. Where DIRECTION captures *why* (vision, decisions, rationale), PLAN captures *what + when + in what order*. Update after every commit: tick boxes, move items between sections, append to *Risks* if something surprising lands.

---

## Snapshot

End-to-end pipe is live. You can launch the app with `npm start`, point Claude Code at `localhost:4318`, and watch:
- The Stats tab populate with real session/message/token counters as Claude Code emits OTEL
- The Home tab's level bar fill, bits accumulate, and "spin available in N messages" tick down
- The animated wizard breathe in both the panel stage and the system tray (head-cropped 4 FPS)

What's *not* yet alive: clicking the spin button does nothing, evolution stages aren't wired to anything, the shop is empty, the only species is wizard, and there's no install flow — Claude Code env vars must be set by hand.

Repo: https://github.com/tdodd777/Codeling · main branch tracking origin

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

Code-only items shipped; the rest is gated on art landing in `assets/sprites/`.

- [ ] Slime/blob species sprites (PixelLab Character Creator export → `assets/sprites/slime/`) — **HUMAN.md**
- [ ] Robot species sprites → `assets/sprites/robot/` — **HUMAN.md**
- [x] Per-species `TRAY_HEAD_FRACTION: Record<Species, number>` (`src/main/index.ts`): `wizard: 0.55`, `slime: 0.85`, `robot: 1.0`. `processForTray(img, species)` reads the fraction; slime/robot values are placeholders to tune once art lands.
- [ ] First-launch starter randomizer (replace hardcoded `wizard` seed) — **blocked on slime + robot art**
- [ ] Silhouette reveal animation on starter assignment — **blocked on starter randomizer**
- [x] Pet rename UI: click `pet-name` on Home → inline input (`PetNameEdit` in `Home.tsx`); IPC `codeling:renamePet(name)` validates 1-`PET_NAME_MAX_LENGTH` chars trimmed, returns distinct `empty-name`/`name-too-long` error codes. Tray tooltip updates via new `pet:renamed` event.
- [ ] Other-direction sprite usage: stage shows pet facing toward whichever side made it gain XP last? (TBD — pick something fun)
- [ ] Cosmetic equip/render: equipped accessories composited over base sprite at runtime (CSS `position: absolute` over `<PetSprite>`, or canvas-based compositor) — **blocked on overlay art**

---

## M3 — Onboarding (the `npx codeling install` story)

This is the make-or-break adoption flow. Build it once the game is fun enough to be worth installing.

- [x] Telemetry env-var installer (interim): `scripts/install-telemetry.{ps1,sh}` with install/uninstall/status modes — sets per-User OTEL env vars (Windows: `[Environment]::SetEnvironmentVariable(..., "User")`; POSIX: marked block in `~/.zshrc` / `~/.bashrc`). Conflict detection on existing `OTEL_EXPORTER_OTLP_ENDPOINT` (warn unless `-Force`/matching ENDPOINT). README updated; real-machine smoke tests tracked in HUMAN.md.
- [ ] Stop hook installer: writes a marked block into `~/.claude/settings.json` that POSTs each Stop event to a Codeling endpoint; uninstaller removes the block. Endpoint adds a supplementary message tally so we catch turns the OTEL exporter dropped.
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
  - Deferred: XP/bit rate edits (need RULES → settings-table refactor), telemetry off switch
- [x] Achievements (state-derived milestones):
  - `src/main/achievements.ts` — 13 defs across engagement / progression / evolution / collection / cost tiers; each `check`s a Snapshot built from sessions + pet + unlocks
  - `achievements (id, earned_at)` table; `evaluateAchievements()` is called after applyEconomy / performSpin / performPurchase
  - Boot-time silent backfill so existing saves don't flood notifications on first ingest tick
  - OS notification per newly-earned achievement (tray balloon via `Notification`)
  - Stats tab renders earned + locked groups with tier-keyed left-border accent (bronze/silver/gold)
- [ ] Daily streak: longer-term tracking (deferred — needs date-bucketing logic + UTC handling)
- [ ] Export / import save (JSON dump of pet + unlocks + sessions, for moving between machines)
- [ ] Multi-machine sync (only if there's user demand — implies an account/server)
- [ ] Daily summary notification ("Yesterday: 12 sessions, 47 messages, 3 levels gained")

---

## Risks / known issues

- **Windows tray icon size cap.** Even with the head-only crop + 40px source, the tray slot is still small relative to text-only icons. May need a per-species redesign (just hat + face emoji-style) if it stays unreadable. Not a code problem — an asset problem.
- **OTLP cumulative-vs-delta assumption.** Aggregator hardcodes DELTA. If Claude Code ever flips to CUMULATIVE temporality, totals will balloon. Add a `aggregation_temporality` branch before that becomes real.
- **better-sqlite3 native rebuild.** Forge handles this via `npmRebuild` on `npm start`. If a teammate hits ABI mismatch errors, the fix is `npx electron-rebuild -f -w better-sqlite3`. Document this in README troubleshooting once it bites someone.
- **No tests yet.** Acceptable for scaffold; add at least integration tests for the OTLP → sessions pipe before the spin reward catalog grows complex enough to regress quietly.
- **Self-feedback loop.** If Codeling ever spawns `claude` (e.g., for a "use Claude to suggest a name" feature), telemetry from that call would feed itself. Handle with `CLAUDE_CODE_ENTRY_POINT` guard or by isolating the receiver per-PID.
- **Tray animation CPU cost.** `setInterval` at 4 FPS swapping pre-rendered images is cheap, but on battery it adds up. Consider pausing animation when system idle (`powerMonitor.on('suspend' | 'lock-screen')`).
