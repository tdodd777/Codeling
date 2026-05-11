# Task: open-source readiness audit + cleanup

You're picking up the **public-repo / OSS-readiness** work on Codeling. The repo is currently a working dev-mode Electron + TS app with a single contributor; the user wants it cleaned up to a shape that's safe to publish publicly (GitHub public repo + eventually npm). Things are messy in places — stale docs from a recent pivot, missing license, no contribution scaffolding.

**There is another Claude Code session working in parallel on `tasks/npx-install.md` (distribution / installer work).** Coordination matters — read the section below before touching shared files.

## Read first

- **`roadmap.md`** — forward-looking work tracker. Update as you ship.
- **`DIRECTION.md`** — decisions log + rationale. Currently 43KB and open in the user's IDE. Append-only convention.
- **`README.md`** — currently dev-focused; the parallel session will be adding user-facing install content. **Hands off — don't edit unless the user explicitly tells you to take it over.**
- **`HUMAN.md`** + **`PLAN.md`** — both contain *stale* content from before the species-collection pivot (Apr 2026 — sorry, 2026-05-11). HUMAN.md still lists cosmetic + evolution-stage asset requests that are now N/A. PLAN.md references the evolution loop. These need either an archive or a rewrite — flag the call as a decision in your analysis.
- **`sprites.md`** — asset reference, license info for CC0 sources.
- **`tasks/npx-install.md`** — the parallel session's brief. Read it so you know what they're touching and stay out of the way.
- **`package.json`** + **`forge.config.ts`** — the parallel session is actively editing both. Touch them only for additions that don't conflict (license field, repository field, etc.) and only after Phase 1 analysis is reviewed.

## Goal

Get the repo to a state where someone could clone it, read the README, file an issue, and contribute a PR without being confused, blocked, or exposed to personal info. Concretely: present, consistent docs; license + contribution scaffolding; CI; no personal/private data leaking; no stale references to deleted features.

## Phase 1 — Analysis only (no source edits)

**Write your findings to `tasks/repo-cleanup-findings.md`.** Categories:

1. **License + legal.**
   - No `LICENSE` file. Recommend MIT (most common for Electron apps + matches the CC0 asset pragma) or Apache-2.0. Flag the call.
   - `package.json` has no `license` field, no `repository` URL, no `homepage`, no `bugs.url`, no `keywords`.
   - Asset attribution: `assets/sources/<creator>/NOTICE.md` per source — verify these exist for every CC0 creator listed in `sprites.md`. Note any missing ones.

2. **Stale or internal docs.**
   - `HUMAN.md` references cosmetics + evolution stages (deleted in pivot). Decide: delete, archive (e.g., `docs/internal/`), or rewrite as "human-only tasks (current)".
   - `PLAN.md` references the evolution loop + cosmetics. Same call.
   - `DIRECTION.md` has dated entries — historically correct, no cleanup needed there. Scan for personal info / non-public details.
   - `roadmap.md` is current and clean.
   - `sprites.md` looks fine; verify against current state.
   - `tasks/*.md` — internal coordination briefs. Probably should move to a non-versioned location (or `.gitignore`'d) before public release. Flag.

3. **Hardcoded personal/local info.**
   - Grep the whole tree for `C:\\Users\\Tyler`, `tdodd777`, `Tyler` (case-insensitive). Anything in committed code, comments, configs, or docs is a leak. Git history is harder to scrub — note instances but don't rewrite history yourself; that's a user decision.
   - Check `.gitignore`: missing entries for `.claude/`, `.cursor/`, any IDE state, OS junk.
   - Verify `*.db` already covered (it is).
   - Check `assets/sources/` — make sure no purchase receipts, license keys, original ZIPs with sensitive metadata are committed.

4. **GitHub project scaffolding.**
   - No `.github/` directory at all today. Need:
     - `.github/ISSUE_TEMPLATE/bug_report.md`
     - `.github/ISSUE_TEMPLATE/feature_request.md`
     - `.github/pull_request_template.md`
     - `.github/workflows/ci.yml` — lint (`npm run lint`) + test (`npm test`) on PR + push. Node 20 + Node 22 matrix; Ubuntu + Windows + macOS runners. Cache `node_modules` via setup-node.
   - `CONTRIBUTING.md` — how to set up, run tests, file an issue, open a PR, commit-message style.
   - `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1 is the de facto choice.
   - `SECURITY.md` — how to report vulns (private email or GH security advisories).

5. **README structure for public consumption.**
   - **Don't rewrite the README yourself** — the parallel session is adding install content. Instead, write an analysis section listing what the README should contain: hero pitch, demo screenshot/GIF, install (npx), system requirements, how telemetry works (privacy story), how to contribute, license. Note current README's gaps so the parallel session can fold in your feedback.

6. **Privacy story.**
   - This app reads OTLP telemetry from Claude Code (locally only, port 4318). Users will want to know nothing leaves their machine. Suggest a "Privacy" section in README + a one-line `PRIVACY.md` covering: what's collected (yes — OTLP + Stop hook), where it goes (your local SQLite only), how to opt out (Settings → Telemetry toggle).

7. **Code-level hygiene** (analyze, don't fix):
   - Are there `TODO` / `FIXME` / `XXX` comments? List the high-impact ones.
   - Any `console.log` calls that should be guarded behind a dev flag?
   - Any commented-out code blocks that can be deleted?

Output: `tasks/repo-cleanup-findings.md` with these categories, each with a recommended action + risk-level (low / medium / high). The user reads this, decides the order, then unblocks Phase 2.

## Phase 2 — Low-risk additions only (after user reviews findings)

After the user approves Phase 1 findings, you may add **new files only** — no edits to tracked files yet. The parallel session is actively writing to those.

Safe Phase 2 additions:
- `LICENSE` (whichever was chosen)
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `PRIVACY.md` (if approved)
- `.gitignore` additions (this is technically an edit, but coordinate first)

Each addition gets its own commit.

## Phase 3 — Tracked-file edits (only after parallel session lands)

The parallel session needs to land its work first. After they signal done (or the user confirms), you can:
- Edit `package.json` to add `license`, `repository`, `homepage`, `bugs`, `keywords`, `author`.
- Edit/delete `HUMAN.md`, `PLAN.md` per the decided fate.
- Scrub any personal info from comments / docs / configs.
- Edit `README.md` for OSS shape (in coordination with the parallel session).
- Move `tasks/` out of the repo or into `.gitignore` if that's the decided fate.

## Hard constraints

- **The user is troubleshooting with the app running in parallel.** Don't restart-required `src/main/` changes. Phase 1 is read-only. Phase 2 is new files only.
- **Don't touch git history.** If you find personal info in old commits, *note it* — the user decides whether to rebase. History rewrites are destructive.
- **Don't run `npm publish` or push tags.** Read-only with respect to remote.
- **Don't edit `README.md`** until the parallel session is done with it.
- **Don't edit `package.json` or `forge.config.ts`** in Phase 1 or 2 — wait for Phase 3 + parallel-session-done signal.
- **Don't touch CLAUDE.md** (none exists; don't create one).
- `npm run lint` + `npm test` must stay green before each commit. 15 tests today; don't regress.

## Conventions

- `roadmap.md` is the punch list. Move items between sections as work lands.
- `DIRECTION.md` gets dated entries for decisions with rationale.
- Conventional commits (`Verb: short summary`, under 70 chars). HEREDOC for multi-line bodies. Footer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Each addition is its own commit. Don't pile changes together.

## Open decisions to flag back, not decide alone

- **License choice** — MIT vs Apache-2.0 vs GPL-3.0. Recommend MIT, but the user picks.
- **HUMAN.md / PLAN.md fate** — delete, archive under `docs/internal/`, or rewrite as current-state docs.
- **`tasks/*.md` fate** — keep in public repo (transparency), move to `.gitignore` (internal), or move to `.claude/`.
- **Author identity in `package.json`** — full name, just GitHub handle, or "Codeling Authors"?
- **Issue template heaviness** — strict templates (Discord/k8s-style) vs lightweight (just a few prompts).
- **CI scope** — just lint+test, or also build verification (`npm run make` smoke)?

## Acceptance criteria for the full task

- `tasks/repo-cleanup-findings.md` exists and covers all seven Phase-1 categories.
- After user approval, Phase 2 additions land as discrete commits.
- After parallel session signals done, Phase 3 edits land.
- The user can answer "yes, this is safe to make public" after reading your final summary.

## Final report shape

When you finish each phase (or hit a blocker), write a concise summary:
- What landed this phase
- What's queued for the next phase
- Decisions you need from the user

Don't dump file contents in the summary.

## Suggested execution order

1. Read this brief. Read `tasks/npx-install.md` so you know what the parallel session owns. Read `roadmap.md` + `DIRECTION.md` (top section, ~last 5 entries).
2. Run the inventory pass: list every top-level doc, every `.github/` artifact (none), every license-relevant file. Grep for personal info.
3. Write `tasks/repo-cleanup-findings.md`. Commit it.
4. Send final report. **Stop and wait for user approval before Phase 2.**
5. Once approved: Phase 2 additions, each as its own commit. Final report.
6. **Stop and wait for parallel session to signal done before Phase 3.**
7. Phase 3 edits. Final report.

Keep momentum but don't outrun the user's read. They're managing two parallel Claude sessions plus their own troubleshooting.
