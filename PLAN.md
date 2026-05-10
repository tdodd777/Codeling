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

---

## In progress

_Nothing currently mid-flight._

---

## M1 — Game loop alive (next up)

Goal: every visible UI element does something real. After M1, the app is a complete (if minimal) game.

### M1.1 — Spin wheel logic
- [ ] Spin reward catalog (`src/main/spin/rewards.ts`): list of items with `id`, `kind` (cosmetic/bits/xp/multiplier), `weight`, `tier`
- [ ] RNG + weighted draw helper
- [ ] IPC `codeling:spin()` — atomically decrements `spins_available`, draws reward, applies effect (insert into `unlocks` for cosmetics; bump `pet.bits`/`pet.xp` for currency drops)
- [ ] Wire spin button on Home tab to call IPC, animate result reveal (CSS transition or simple fade-in)
- [ ] Coalesce broadcast so panel refreshes pet + new unlock list
- **Acceptance**: Click spin button → see reward toast → spin counter decrements → if cosmetic, appears in shop's owned section

### M1.2 — Evolution thresholds
- [ ] Per-species evolution table (token thresholds → `evolution_stage`): `EVOLUTIONS: Record<Species, number[]>`
- [ ] In `applyEconomy`: after token writes, check if cumulative-tokens-for-pet crosses the next threshold; bump `evolution_stage`
- [ ] Sprite manifest already supports per-stage subdirs in concept — formalize layout: `assets/sprites/<species>/stage_<N>/...`
- [ ] `<PetSprite>` reads `pet.evolution_stage` and loads the right sprite set
- [ ] Tray icon refresh on evolution (use `codeling:update` to rebuild tray frames)
- **Acceptance**: Hit a configured token threshold → pet sprite changes to next stage → tray follows → console logs evolution event

### M1.3 — Cost tracking
- [ ] Add `cost_usd REAL DEFAULT 0` column to `sessions` (migration in `client.ts`)
- [ ] Aggregator: handle `claude_code.cost.usage` metric (DELTA, `as_double`)
- [ ] `LifetimeStats` adds `totalCostUsd`; Stats tab renders one row
- **Acceptance**: After a Claude session, Stats shows non-zero "Cost" formatted as `$X.XX`

### M1.4 — Minimum viable shop
- [ ] Shop catalog (`src/main/shop/catalog.ts`): a handful of cosmetics + 1-2 upgrades with prices in bits
- [ ] IPC `codeling:purchase(itemId)` — checks bits, decrements, inserts into `unlocks`
- [ ] Shop tab renders catalog, marks owned, disables button when broke
- [ ] First upgrade: `bit_multiplier_2x` — economy reads owned upgrades and applies to bits earnings
- **Acceptance**: Buy item → bits decrease → item moves to "owned" → for upgrades, future earnings reflect the bonus

### M1.5 — Per-character pet-stage background
- [ ] Sprite manifest exposes `background?: string` from `assets/sprites/<species>/background.png` if present
- [ ] Home tab `.pet-stage` div uses it as `background-image` (no PNG present → keep current flat panel)
- [ ] Drop in a wizard background (PixelLab can generate scenery — tower interior or library)
- **Acceptance**: Wizard sits in a themed scene instead of a flat purple box

---

## M2 — Multi-species + visual polish

- [ ] Slime/blob species sprites (PixelLab Character Creator export → `assets/sprites/slime/`)
- [ ] Robot species sprites → `assets/sprites/robot/`
- [ ] Per-species `TRAY_HEAD_FRACTION` map (slime probably wants 0.7+, robot may need full body)
- [ ] First-launch starter randomizer (replace hardcoded `wizard` seed)
- [ ] Silhouette reveal animation on starter assignment
- [ ] Pet rename UI (small input on Home tab, IPC `codeling:renamePet`)
- [ ] Other-direction sprite usage: stage shows pet facing toward whichever side made it gain XP last? (TBD — pick something fun)
- [ ] Cosmetic equip/render: equipped accessories composited over base sprite at runtime (CSS `position: absolute` over `<PetSprite>`, or canvas-based compositor)

---

## M3 — Onboarding (the `npx codeling install` story)

This is the make-or-break adoption flow. Build it once the game is fun enough to be worth installing.

- [ ] Telemetry env-var installer (interim): `scripts/install-telemetry.{ps1,sh}` with install/uninstall/status modes — set per-user OTEL env vars. Documented as a stopgap until the bundled installer lands.
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

- [ ] Settings panel: spin threshold, XP/bit rates (with sane caps), telemetry off switch, reset save
- [ ] Achievements / streaks: daily streak, milestone notifications via tray balloon
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
