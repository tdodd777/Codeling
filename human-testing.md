# Human testing handoff

You're picking up from a session where we shipped a large batch of features and started walking through a manual smoke-test pass. Section 1 passed cleanly. Section 2 was about to start when we discovered the running Claude Code process didn't have the OTEL env vars (it was launched before `install-telemetry.ps1 install` ran), so the messages weren't reaching Codeling's receiver.

The user is now in a **fresh Claude Code session** launched from a PowerShell that *does* have the OTEL env vars set. This conversation is that session. Telemetry should now flow.

## Where things are

- Branch: `main`, **12 commits ahead of origin** (not yet pushed). Range: see `git log --oneline origin/main..HEAD`.
- `npm test` → 15 pure-logic tests pass.
- `PLAN.md`, `DIRECTION.md`, `HUMAN.md` are all current.
- Codeling app: should already be running (`npm start` from a prior window). Verify the tray icon is there and the panel opens.

## Pre-flight (do these first)

Run in PowerShell:

```powershell
# 1. Confirm the running shell has the env vars
$env:OTEL_EXPORTER_OTLP_ENDPOINT     # expect http://127.0.0.1:4318
$env:CLAUDE_CODE_ENABLE_TELEMETRY    # expect 1

# 2. If they're blank, run installer + close everything + reopen a new PowerShell
.\scripts\install-telemetry.ps1 install
# then close this PowerShell, open a new one, relaunch Claude Code from it

# 3. Confirm Codeling receivers are listening
.\scripts\install-telemetry.ps1 status   # all six should be set
```

Then verify telemetry is now flowing: send a message to this Claude Code session, and within a few seconds Codeling's `npm start` console should log a line like:

```
[otel:http] log resourceLogs=1 records=N → sessions=1 +message_count=1 | +xp=10 +bits=5
[otel:http] metric resourceMetrics=1 metrics=N → sessions=1 +output_tokens=...
```

If that line never shows up, telemetry still isn't routed. Stop and debug before continuing — likely the shell hosting Claude Code is still missing the env vars.

## What's already validated

- ✅ **Section 1 — sanity**: `npm test` (15/15), `npm start` boots cleanly, no migration errors against an existing save, both OTLP receivers up, sprite manifest scans cleanly.
- ⚠️ Known minor: the `[sprites] wizard stage 0: ...` log fires 3× per panel mount. PetSprite + Home both call `getSprites`, plus React StrictMode dev double-mount. Documented in `DIRECTION.md` "Open questions" — defer fixing until before the next renderer feature.

## Test sections still to walk through

### Section 2 — Settings (~2 min)

1. Open Settings tab.
2. **Spin threshold**: drop to **5** (Enter or click outside to commit). Persists instantly.
3. **Economy**: bump **xpPerMessage** to **50**. Send a Claude message → on Home, +50 XP per message. Ingest log line should show `+xp=50` per message.
4. Click **"Reset to defaults"** → all four rates revert to 10/100/5/1000.
5. **Application** → toggle **Launch on login**. Should flip without delay; truthfully reflects what the OS accepts.
6. **Save → Export** → pick a path → save → open the JSON. Should have `version: 1`, `exportedAt`, plus arrays for `pet`, `sessions`, `unlocks`, `spin_state`, `achievements`, `daily_activity`, `meta`.
7. **Save → Import** → pick the same file → "Imported from …" success. State identical.

### Section 3 — Game loop (5 min while using Claude Code normally)

- Stats tab climbs (sessions, messages, input/output tokens, **cost** non-zero `$0.XXXX`).
- Home: XP bar fills, level-ups happen, bits accumulate; **"1-day streak"** pill appears after first message.
- **"First word" achievement** fires (OS notification + Stats list shows it under Earned).
- After **5 messages** (threshold=5 from section 2), click **Spin** → tier-styled reveal toast. Bits / cosmetic / xp delivered. **Esc** dismisses.
- Shop tab: buy `glasses` (100 bits) → click **Equip** → button flips to "Equipped" (no visual change without art — expected).
- Buy `bit_multiplier_2x` (500 bits) → next ingest tick: bits earned should roughly **double**.

### Section 4 — Stop hook (Windows + a real Claude turn)

```powershell
npm run stop-hook:status      # "not installed"
npm run stop-hook:install     # adds entry to ~/.claude/settings.json
# trigger any normal Claude Code turn end
# Codeling main-process console should log a [stop-hook] receipt
npm run stop-hook:uninstall   # surgical removal
```

### Section 5 — Telemetry installer details (only if not already validated)

```powershell
.\scripts\install-telemetry.ps1 status
.\scripts\install-telemetry.ps1 install
# new PowerShell tab:
$env:OTEL_EXPORTER_OTLP_ENDPOINT   # http://127.0.0.1:4318
```

Conflict test (optional): set `$env:OTEL_EXPORTER_OTLP_ENDPOINT` to a different URL, run `install` → should warn and bail. Re-run with `-Force` → should overwrite.

### Section 6 — Keyboard shortcuts

- `Ctrl+1`/`2`/`3`/`4` switches tabs.
- Click pet name on Home → type → `Ctrl+1` should NOT steal focus mid-typing.
- Spin reveal toast → `Esc` closes.

### Section 7 — Reset save (last, since destructive)

- Settings → Danger zone → **Reset save** → confirm.
- Pet returns to "Wizard", level 1, 0 bits, achievements/streak/cosmetics all clear, sessions Stats wiped.

### Things hard to test without contrived setup (skip unless curious)

- **CUMULATIVE-temporality skip** — only triggers if Claude Code switches the metric. You'd have to inject a fake payload.
- **Stop hook OTEL-drop backfill** — only matters when OTEL drops a `user_prompt`. Not naturally reproducible.
- **Daily summary** — fires once per local day after midnight rollover. Force-test by editing `meta.value WHERE key='last_summary_date'` to yesterday's date in the DB (`%APPDATA%/Codeling/codeling.db`).
- **Cosmetic overlay render** — needs a PNG. Drop any small transparent PNG at `assets/sprites/wizard/cosmetics/glasses/south.png` and restart the app; equipped glasses will composite.

## When testing is done

If everything passes:
```powershell
git push origin main          # ship the 12 commits
```

If anything failed: paste the console output / DB state / repro steps. The handoff Claude can dig in or hand back to the user with a fix recommendation.

## Useful state references

- DB location: `%APPDATA%/Codeling/codeling.db` (open with any SQLite browser)
- Codeling main-process console: where `npm start` is running
- Hooks settings: `~/.claude/settings.json`
- User-scope OTEL env vars: `[Environment]::GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT", "User")`
