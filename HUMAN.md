# Human-only tasks

Things Claude can't do, that you (or another human with the right tools/accounts) need to handle. Append as new ones surface; tick when done.

Group by *kind of work*, not by milestone — a single asset request often unblocks multiple milestones.

---

## Asset generation (PixelLab Character Creator)

Drop new exports into `assets/sprites/<species>/...`. The scanner (`src/main/sprites.ts`) reads PixelLab's native folder layout — no rename or reshape needed.

### Cosmetics (M1.1 wheel rewards + M1.4 shop items)

The COSMETICS registry (`src/main/spin/rewards.ts`) lists every cosmetic the game can grant. Each needs an overlay PNG so the equipped item composites over the base sprite.

Wheel-only:
- [ ] **`party_hat`** — uncommon. Pointy birthday hat, fits humanoid (wizard) head silhouette
- [ ] **`monocle`** — rare. Eye-piece + chain, single eye
- [ ] **`crown`** — legendary. Royal crown, gold + jewels

Shop-buyable (also referenced in `src/main/shop/catalog.ts`):
- [ ] **`glasses`** — common, 100 bits. Smart-looking spectacles
- [ ] **`witch_hat`** — uncommon, 250 bits. Pointed wide-brim hat (distinct from wizard's existing pointy hat — pointed *and* wide-brimmed)

**Convention (wired up — drop a PNG and it composites):** `assets/sprites/<species>/cosmetics/<cosmeticId>/<direction>.png`. Each is a same-canvas-size overlay aligned to the base sprite. South direction is the only one strictly required; renderer falls back to south if other directions are missing. Per-stage overrides also work: drop into `stage_<N>/cosmetics/<cosmeticId>/...` and that beats the species-root version once the pet evolves.

The equip toggle, manifest scanning, and overlay rendering are all wired. Until you drop a PNG, the equip button toggles silently with no visual change — the renderer just doesn't have anything to composite. Drop a `south.png` and it appears immediately on next manifest fetch.

### Evolution stages (M1.2)

Currently only stage 0 art exists for wizard. Drop higher-stage exports into `stage_<N>/` subdirs and the manifest scanner will pick them up automatically (graceful fallback to root if missing).

- [ ] **`assets/sprites/wizard/stage_1/`** — at 50k cumulative output tokens. Slightly more powerful look (e.g., glowing staff, runes on robe).
- [ ] **`assets/sprites/wizard/stage_2/`** — at 200k. Archmage tier.
- [ ] **`assets/sprites/wizard/stage_3/`** — at 500k. Cosmic / ascended.

Each stage folder mirrors the root layout — `rotations/` (8 directions) + `animations/<name-hash>/<direction>/frame_NNN.png`. Re-thresholds in `src/main/evolution.ts` if pacing feels off.

### New species (M2)

- [ ] **`assets/sprites/slime/`** — full directional set + Breathing_Idle animation. Round, viscous, more head-than-body silhouette so the tray crop reads.
- [ ] **`assets/sprites/robot/`** — same. Likely needs a different `TRAY_HEAD_FRACTION` (humanoid wizard uses 0.55; robot may want full body).

When slime/robot land, a follow-up code change is needed to:
- Add per-species tray crop fractions (`TRAY_HEAD_FRACTION: Record<Species, number>`)
- Switch the seed in `src/main/db/client.ts` from hardcoded `wizard` to a random starter
- Wire the silhouette reveal animation on first launch

### Per-pet stage backgrounds (M1.5)

Wired up — drop a PNG and it appears in the Home tab. No code change needed.

- [ ] **`assets/sprites/wizard/background.png`** — apprentice-tier scene behind the wizard. Suggested: spellbook desk, library nook, or tower interior. Recommended size: 380×160 (matches the `.pet-stage` slot at 1:1; will scale via `background-size: cover` if larger). Pixel-art preferred — renderer applies `image-rendering: pixelated`.
- [ ] **`assets/sprites/wizard/stage_2/background.png`** (optional, future) — archmage-tier scene. Stage-specific override; `findBackground` checks here before falling back to the species default.
- [ ] **`assets/sprites/wizard/stage_3/background.png`** (optional, future) — cosmic / ascended scene.

---

## Distribution / signing (M4)

These need real money + accounts and can't be set up programmatically.

- [ ] **macOS code signing** — Apple Developer ID ($99/yr) + notarization. Required to avoid Gatekeeper warning.
- [ ] **Windows code signing** — Authenticode certificate. Can defer with SmartScreen warning for early users.
- [ ] **Homebrew tap** — register `homebrew-codeling` repo (or use a third-party tap), submit cask formula.
- [ ] **Scoop manifest** — submit to a scoop bucket (or self-host).
- [ ] **winget submission** — open PR against `microsoft/winget-pkgs`.

---

## OTEL / install flow validation (M3)

The interim env-var installer scripts are in place at `scripts/install-telemetry.{ps1,sh}`. Each platform path needs a real-machine smoke test before it's trusted in the bundled `npx codeling install` flow:

- [ ] **Windows** — run `.\scripts\install-telemetry.ps1 install` in PowerShell. Open a brand-new shell (or VS Code window) → confirm `$env:OTEL_EXPORTER_OTLP_ENDPOINT` is `http://127.0.0.1:4318` and Claude Code starts feeding the receiver. Run `uninstall` → confirm vars come back unset.
- [ ] **macOS** (zsh) — run `./scripts/install-telemetry.sh install`. Open a new Terminal/iTerm tab → `printenv | grep -E 'OTEL|CLAUDE'` should show all six vars. Run `uninstall` → block is gone from `~/.zshrc`. Confirm only the marked block was touched (other rc edits intact).
- [ ] **Linux** (bash) — same drill against `~/.bashrc`.
- [ ] **Conflict detection** — set `OTEL_EXPORTER_OTLP_ENDPOINT` to a non-Codeling URL first, then run `install`. Confirm: warning lands, no overwrite. Re-run with `-Force` (Windows) or matching `ENDPOINT=...` arg (POSIX) → confirm overwrite proceeds.
- [ ] **Stop hook installer** (`scripts/install-stop-hook.mjs`) — run `npm run stop-hook:install` against a `~/.claude/settings.json` that already has a non-Codeling Stop hook. Confirm: existing entries are preserved, Codeling's entry is appended once. Run again → still exactly one Codeling entry. Run `stop-hook:uninstall` → only the Codeling entry is removed, others intact.
- [ ] **Stop hook end-to-end** — start `npm start` (Codeling running), `stop-hook:install`, then trigger a Claude Code Stop event (any normal `claude` invocation that completes a turn). Codeling's main-process console should log a stop-hook receipt; if you bumped the OTEL exporter off, message_count should still climb on the Home tab.

---

## Playtesting / balance

These aren't blocked — anyone can do them — but they're judgment calls that need real session data, not code:

- [ ] **Confirm spin reward weights feel right** after ~20 spins. `src/main/spin/rewards.ts` → `REWARDS`. Adjust `weight` and `CONSOLATION_BITS` if any tier feels too common or too rare.
- [ ] **Confirm evolution thresholds** (`src/main/evolution.ts` → `EVOLUTIONS`) are reachable in a few weeks of normal use. Right now they're guesses (50k / 200k / 500k cumulative output tokens).
- [ ] **Confirm spin granted cadence** (50 messages — `spin_state.spin_threshold` default in seed). Tune up or down once playtesters give feedback.
- [ ] **Confirm cost-display precision** — current Stats row shows up to 4 decimals so early sub-penny totals are visible. Once normal totals are routinely above $1, drop back to 2dp.

---

## Repository / ops

- [ ] **Push local commits to `origin/main`** when this branch is ahead. `git push origin main` — Claude is gated from pushing to the default branch in auto mode, so this stays manual.
- [ ] **Open issues** in https://github.com/tdodd777/Codeling for any item promoted from `## Risks / known issues` in `PLAN.md` once you want them tracked publicly (right now everything's in-tree docs).
