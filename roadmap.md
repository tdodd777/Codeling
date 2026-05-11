# Codeling — Roadmap

Living forward-looking doc. Reflects the current build state, what's in flight, and what's queued. Edit as work lands. The *why* behind decisions lives in `DIRECTION.md`; this file is the *what* and *what's next*.

> Convention: when work lands, move it from **In progress** / **Next up** to **Recently shipped** (with commit hash). When new ideas arrive, add to **Next up** (ordered) or **Later** (unscoped). Keep entries one or two lines each — a punch list, not a spec.

---

## Current state (what works today)

**Core loop**
- 15-species roster scanned from `assets/sprites/<species>/`.
- Random starter assigned on first launch; sticky via `INSERT OR IGNORE`.
- Bits buy new species in the Shop (tier-priced 200/400/800/1500).
- `setActiveSpecies` swaps the rendered pet on Home + tray.
- Per-species animation unlocks: dynamic catalog from disk-scan, bits-priced + XP-gated. Idle is the always-free baseline.
- Home animation picker — per-species persisted preference; buying `run` actually animates `run` on the panel.

**Economy**
- XP + bits from OTLP messages/tokens (editable rates in Settings via `meta`-backed rules).
- Levels with linear curve; XP carried forward on level-up.
- Spin wheel every N messages (configurable threshold). Rewards: bits / xp / species-token (rare).
- Permanent `2× bits` upgrade purchasable.

**Surface area**
- Tray icon animates with current species' idle frames.
- Three-tab panel: Home / Shop / Stats; plus Settings.
- Shop subtabs: Species / Animations / Upgrades.
- Achievements (state-derived): engagement, progression, collection, animations, upgrades, cost, streaks. 16 defs.
- Daily streak tracking (local-date bucketed) + daily summary OS notification.
- Save export/import (versioned JSON).
- Auto-launch on login toggle.

**Plumbing**
- OTLP HTTP receiver (`127.0.0.1:4318`) + gRPC receiver (`127.0.0.1:4317`).
- Stop-hook backup endpoint at `/codeling/stop-event` (catches OTEL drops at turn end).
- Telemetry installer scripts (`.ps1` / `.sh`) + Stop-hook installer.
- Live updates: ingest broadcasts `codeling:update` → renderer refetches.
- Per-species head-crop tuning for tray sprite rendering.

**Distribution: not yet.** Dev-only `npm start` flow; no packaging / signing / auto-update.

---

## In progress

*(nothing active)*

---

## Next up (ordered — top is next)

1. **Silhouette previews for unowned species.** Shop currently shows full-color art with a price tag. Alpha-flatten to black would make the collection feel more like a wallchart. Needs a render utility or pre-baked silhouette PNGs.
2. **Bundled `npx codeling install`.** Assembly + `bin` setup wrapping the existing pieces (`scripts/install-telemetry.{ps1,sh}`, `scripts/install-stop-hook.mjs`, auto-launch toggle) into one command. The north-star install per `DIRECTION.md`.
3. **Telemetry on/off switch in Settings.** Receiver port lifecycle (start/stop without restarting the app). Spec out before building. *Deferred from M5.*
4. **Tray icon refresh on species change — production-grade.** Add `pet:species-changed` listener that compares with the last-rendered species so swap-via-DB-edit (test paths, future save-import) also refreshes. *Open question in DIRECTION.md.*

---

## Later (unscoped — pick when relevant)

- **Distribution.** Code signing (macOS notarization, Windows Authenticode — paid certs), auto-updates via Squirrel.Mac / Squirrel.Windows, DMG / MSI / Squirrel installer outputs, Homebrew tap, Scoop manifest, Winget submission.
- **Robot species art.** David Harrington CC0 robot identified in `sprites.md`; drop-in candidate but not yet integrated.
- **Four more LuizMelo creatures.** Goblin / skeleton / mushroom / rat already integrated; sources archive in `assets/sources/luizmelo/` has more — quick wins via `scripts/luizmelo-slice.py`.
- **Starter selection animation.** Silhouette reveal on first launch. Was blocked on slime/robot art originally; post-pivot it's a polish layer over the existing random-starter flow.
- **Animation pricing tuning.** Numbers in `shop/animations.ts` are placeholders. Instrument `bits / cheapest-locked-animation` ratio post-playtest, then tune.
- **8-directional rendering.** Scanner already finds 8-direction frames; renderer + tray use south-only. Pick a behavior (face direction of last XP source? camera follow?) once the rest stabilizes.
- **Multi-machine sync.** Implies cloud + account. Default answer: no, local-only. Save export/import covers manual migration in the meantime. *Open question.*
- **OTLP cumulative-temporality resilience.** Aggregator skips CUMULATIVE metrics with a warning. Proper handling (per-(session, field) cumulative state for delta derivation) is open if Claude Code ever switches.
- **Stop-hook vs OTEL ordering race (double-count).** With the Stop hook installed, races between Stop and OTEL `user_prompt` can over-count messages. Three known fix shapes in `DIRECTION.md` open-questions.
- **Hook loop risk.** A Stop-hook installer that calls back into Codeling's HTTP receiver could loop if Codeling itself ever invokes `claude`. Premature guard.

---

## Recently shipped

- `601907f` — Animation picker always visible (shows locked pills with price/level tooltip for unowned anims); spin reveal swapped to a clean circular spinner
- `5175927` — Sprite scanner: fuller-anim-wins on alias collision; Mimic's idle frames no longer overwritten by single-frame static poses; 7 new tests
- `95528e0` — Spin reveal animation: 900ms anticipation (tier cycle + pulsing label) before the result lands; skippable via click/Esc
- `7b2e8f0` — PetSprite takes manifest as prop; eliminates duplicate getSprites fetches; Home resets manifest on species swap so stale frames don't render
- `e297819` — Popout polish: tray click intercepted at source (no flicker); PetSprite renders only once manifest loaded (fix initial-blank bug)
- `02f2d43` — Popout window: standalone resizable BrowserWindow, hides tray panel while active, bounds persisted in `meta`
- `33d47a0` — Home animation picker (per-species persisted choice)
- `88d50c7` — Pivot to species collection + animation unlocks (delete evolution + cosmetics)
- `713f3e6` — Docs refresh (README/PLAN/HUMAN, current roster)
- `1f508de` — Sprite roster: goblin / skeleton / mushroom / rat
- `7c54491` — Sprite roster expansion: 8 LuizMelo species + asset pipeline
- `dfb084f` — Smoke-test pass + doc consolidation
- `fe6ef22` — M5: editable XP/bit rates in Settings via meta-backed economy rules
- `5f57f6e` — Tests: vitest setup + pure-logic suites
- `b7095bf` — M2 partial: cosmetic equip toggle + overlay composite *(superseded by 88d50c7 pivot)*
- `9d637c2` — Aggregator: defensive CUMULATIVE-temporality branch
