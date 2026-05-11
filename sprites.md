# Sprite roster — open-source candidates

A living catalog of free pixel-art sprites vetted for use as additional Codeling pet species. Update as new finds land or assets get integrated.

Every entry has been checked for license compatibility with an MIT/Apache open-source distribution. **Don't add anything to this doc without verifying the license on the source page** — itch.io defaults are not consistent across creators.

The bar for inclusion is **rich animation**: ≥6 frames per animation, ≥3 distinct animations per creature. The early-round picks that didn't hit that bar (Stealthix slimes, basic 2-frame loops) have been dropped — they read as "static with a wobble" once you see them in the tray. Anything below that threshold is documented in the rejected section so future researchers don't re-discover them.

## Acceptable licenses

| License | OK? | Notes |
|---|---|---|
| CC0 / Public Domain | ✅ | No attribution required (but list in NOTICE.md anyway, free goodwill) |
| CC-BY (3.0 / 4.0) | ✅ | Attribute in `assets/sources/<species>/NOTICE.md` |
| MIT | ✅ | Note credit + repo link |
| CC-BY-SA | ❌ | Share-alike clause forces our code/assets to inherit copyleft — incompatible with MIT |
| CC-BY-NC | ❌ | "Non-commercial only" — distribution in an open-source repo is at-best ambiguous in most jurisdictions |
| CC-BY-ND | ❌ | "No derivatives" — kills cropping, recoloring, resizing, parallax remixing |
| GPL / AGPL | ❌ | Copyleft. Same blocker as CC-BY-SA |
| "Free for personal use" / "no resale" / "no redistribution" / Patreon-tier | ⚠️ | Reject unless creator explicitly confirms open-source redistribution is fine |

When in doubt, **don't ship raw source PNGs**. Compositing assets into derived sprites at build time and shipping only the composite is a common workaround for "free in-game, not for redistribution" terms — but adds build complexity and is brittle to license re-reads. Avoid if possible.

## Currently integrated

| Species | Source | License | Frames |
|---|---|---|---|
| `wizard` | PixelLab Character Creator (paid) | Per PixelLab ToS | 8-direction + Breathing_Idle + Running |
| `slime` | [rvros — Animated Pixel Slime](https://rvros.itch.io/pixel-art-animated-slime) | CC0 | Idle 4f + Running 4f |
| `flying_eye` | [LuizMelo MCF1 — Flying eye](https://luizmelo.itch.io/monsters-creatures-fantasy) | CC0 | Idle 8f + Attack ×3 (8/8/6) + Hurt 4f + Death 4f — 38 total |
| `bat` | [LuizMelo MCF2 — Bat](https://luizmelo.itch.io/monsters-creatures-fantasy-2) | CC0 | Idle 11f + Attack 11f + Hurt 3f + FlyToFall 3f + Fall 5f + Death 4f — 37 total |
| `mimic` | [LuizMelo MCF2 — Mimic](https://luizmelo.itch.io/monsters-creatures-fantasy-2) | CC0 | Idle 9f + Walking 6f + Attack ×2 (14/13) + Opening 6f + Transform 7f + ChestClosed/Open (1f each) + Hurt 3f + Death 6f — 66 total |
| `evil_wizard` | [LuizMelo — Evil Wizard 2](https://luizmelo.itch.io/evil-wizard-2) | CC0 | Idle 8f + Running 8f + Jump 2f + Fall 2f + Attack ×2 (8/8) + Hurt 3f + Death 7f — 46 total |
| `fire_worm` | [LuizMelo — Fire Worm](https://luizmelo.itch.io/fire-worm) | CC0 | Idle 9f + Walking 9f + Attack 16f + Hurt 3f + Death 8f — 45 total |
| `martial_hero` | [LuizMelo — Martial Hero](https://luizmelo.itch.io/martial-hero) | CC0 | Idle 8f + Running 8f + Jump 2f + Fall 2f + Attack ×2 (6/6) + Hurt 4f + Death 6f — 42 total |
| `martial_hero_2` | [LuizMelo — Martial Hero 2](https://luizmelo.itch.io/martial-hero-2) | CC0 | Idle 4f + Running 8f + Jump 2f + Fall 2f + Attack ×2 (4/4) + Hurt 3f + Death 7f — 34 total |
| `apprentice_wizard` | [LuizMelo — Wizard Pack](https://luizmelo.itch.io/wizard-pack) | CC0 (inferred — pack ships without License.txt; matches LuizMelo's consistent practice) | Idle 6f + Running 8f + Jump 2f + Fall 2f + Attack ×2 (8/8) + Hurt 4f + Death 7f — 45 total. **Note**: this pack uses non-square (231×190) frames; the slicer config carries explicit per-anim frame counts for it. |
| `goblin` | [LuizMelo MCF1 — Goblin](https://luizmelo.itch.io/monsters-creatures-fantasy) | CC0 | Idle 4f + Running 8f + Attack ×3 (8/8/12) + Hurt 4f + Death 4f — 48 total |
| `skeleton` | [LuizMelo MCF1 — Skeleton](https://luizmelo.itch.io/monsters-creatures-fantasy) | CC0 | Idle 4f + Walking 4f + Attack ×3 (8/8/6) + Shield 4f + Hurt 4f + Death 4f — 42 total |
| `mushroom` | [LuizMelo MCF1 — Mushroom](https://luizmelo.itch.io/monsters-creatures-fantasy) | CC0 | Idle 4f + Running 8f + Attack ×3 (8/8/11) + Hurt 4f + Death 4f — 47 total |
| `rat` | [LuizMelo MCF2 — Rat](https://luizmelo.itch.io/monsters-creatures-fantasy-2) | CC0 | Idle 10f + Running 8f + Attack 12f + Hurt 3f + Death 6f — 39 total |
| `robot` | _none yet_ | — | Listed in `Species` type, no art |

---

## Top 5 — go grab these

**LuizMelo is single-handedly carrying the CC0 + rich-animation niche.** All five picks below are from his itch.io packs. Ranked by animation budget × pet suitability.

1. **[Monsters Creatures Fantasy 2 — Mimic](https://luizmelo.itch.io/monsters-creatures-fantasy-2)** — CC0. **10 animations / 60 frames**: idle closed, opening, idle open, transform, idle transformed, walk, bite, tongue attack, hurt, death. 42×30 px, single-direction. A treasure-chest pet that transforms — unmatched animation budget for a free asset. Anim quality 5/5, pet vibe 5/5.

2. **[Monsters Creatures Fantasy 2 — Bat](https://luizmelo.itch.io/monsters-creatures-fantasy-2)** — CC0. **6 animations / 37 frames**: fly, attack, hurt, fly-to-fall transition, fall, death. 51×38 px, single-direction. Perfect tray-pet silhouette + a state-transition animation that's rare in free assets.

3. **[Monsters Creatures Fantasy — Flying Eye](https://luizmelo.itch.io/monsters-creatures-fantasy)** — CC0. **4 animations**: flight 8f, attack 8f, hit 4f, death 4f. Single-direction. Floats, blinks, hovers — reads as alive even at small scale. Pet vibe 5/5.

4. **[Monsters Creatures Fantasy 2 — Slime](https://luizmelo.itch.io/monsters-creatures-fantasy-2)** — CC0. **5 animations / 53 frames**. 44×18 px. A direct upgrade path for the existing rvros slime — same species slot, much more frame budget. Worth A/B testing in-app to decide which feels better.

5. **[Monsters Creatures Fantasy — Mushroom](https://luizmelo.itch.io/monsters-creatures-fantasy)** — CC0. **5 animations**: idle 4f, run 8f, attack 8f, hit 4f, death 4f. Single-direction. Strong "weird little forest pet" energy.

**Bonus** — pull these alongside the top 5 for the long tail:

- **[Monsters Creatures Fantasy 2 — Rat](https://luizmelo.itch.io/monsters-creatures-fantasy-2)** — CC0, 5 anims / 39 frames, 40×20.
- **[Monsters Creatures Fantasy — Goblin](https://luizmelo.itch.io/monsters-creatures-fantasy)** — CC0, 5 anims (idle 4f, run 8f, attack 8f, hit 4f, death 4f). Slightly humanoid, lower pet vibe (3/5).
- **[Monsters Creatures Fantasy — Skeleton](https://luizmelo.itch.io/monsters-creatures-fantasy)** — CC0, 6 anims (adds shield 4f beyond the goblin set). Humanoid, pet vibe 3/5.
- **[LuizMelo Wizard Pack](https://luizmelo.itch.io/wizard-pack)** — CC0. 8 anims / 45 frames (idle 4f, run 8f, jump 2f, fall 2f, attack1 8f, attack2 8f, hit 4f, death 7f). Humanoid — useful only if you want a stylistic alt to PixelLab's wizard. Pet vibe 2/5 but anim quality 4/5.

---

## Catalog (organized by use case)

### Best CC0 pet candidates (rich animation)

| Pack | Creator | License | Best creatures | Anim budget |
|---|---|---|---|---|
| [Monsters Creatures Fantasy 2](https://luizmelo.itch.io/monsters-creatures-fantasy-2) | LuizMelo | CC0 | Mimic, Bat, Slime, Rat | 5–10 anims per creature, 37–60 total frames |
| [Monsters Creatures Fantasy 1](https://luizmelo.itch.io/monsters-creatures-fantasy) | LuizMelo | CC0 | Flying Eye, Mushroom, Goblin, Skeleton | 4–6 anims, 24–32 total frames |
| [Wizard Pack](https://luizmelo.itch.io/wizard-pack) | LuizMelo | CC0 | (humanoid only) | 8 anims / 45 frames |

### Useful with CC-BY attribution

| Pack | Creator | License | Notes |
|---|---|---|---|
| [Animated Fox Sprite Pack](https://opengameart.org/content/animated-fox-sprite-pack-4-actions-idle-run-attack-death) | IDoTheDrawing | **CC-BY 3.0** | Idle 6f, Run 8f, Attack 5f, Death 4f. 64×64. Direction unspecified. Pet vibe 5/5, anim quality 3.5/5. |
| [Quintino Pixels CC-10](https://quintino-pixels.itch.io/cc-10-pixel-art-animated-enemies) | Quintino | **CC-BY 4.0** | Only 2 enemies (Evil Pumpkin, Eye Bat). Sparse — not a top pick. |

### Paid (CC0 once purchased) — open-the-wallet tier

LuizMelo's premium packs all become CC0 once bought. Best $:animation ratio in the free-asset space if you want to expand the roster beyond what's free:

| Pack | Price | Contents |
|---|---|---|
| [Creature Character](https://luizmelo.itch.io/creature-character) | $8 | 6–8 anims, 7–17 frame attacks |
| [Fantasy Beast](https://luizmelo.itch.io/fantasy-beast) | $5 | Same rich anim treatment |
| [Fantasy Troll](https://luizmelo.itch.io/fantasy-troll) | $8 | Same |

---

## Rejected

| Source | Reason |
|---|---|
| Stealthix Animated Slimes | Sparse animation (2–3 frame loops); falls below "feels alive" threshold |
| Stealthix Animated Monsters | Same — frame counts not published but visually similar to the slimes |
| Penzilla slimes | Standard itch.io license (paid) — not free / not CC0 |
| rvros Adventurer | "No redistribute" clause kills public repo use |
| Elthen Patreon packs | Anti-blockchain / NC rider — ambiguous for open-source ship |
| OpenGameArt "Owl and Raven" | CC-BY-SA — share-alike incompatible |
| edermunizz Free Pixel Art Forest | CC-BY-ND — no derivatives allowed |
| CraftPix free tier | Account-gated, no-redistribute — workable for binary, awkward for public repo |
| LPC Generator (full) | Dual-licensed includes GPL clause — copyleft risk |
| Pixel Frog Tiny Swords | "You may not redistribute, resell, or repackage the assets" — explicit reject of public-repo use |
| Iphigenia Pixels Monster Pack Level 1 | Custom non-redistribution clause |
| Kenmi Cute Fantasy RPG (free tier) | Non-commercial license |
| Pixel Frog Kings and Pigs / Pirate Bomb | CC0 but humanoid armed pigs / pirates — low pet vibe (anim quality is good if you want enemy NPCs) |
| v3x3d Paper Pixels | CC0 but 8×8 — too small for tray-icon detail |

---

## Animation quality bar — what to expect

Lessons learned from integrating the rvros slime (4-frame idle, 4-frame move):

- **2-frame "wobble" loops** read as static with a hiccup. The Stealthix slimes have this. Avoid.
- **4-frame idle** is the floor — enough to register as breathing/bobbing but not visually rich.
- **6–8 frame idle/run** is where animation starts to feel alive — eye blinks, tail wags, hair sway, smear frames in the run cycle.
- **State-transition animations** (fly-to-fall, transform, sleep-to-wake) are rare in free assets and disproportionately add charm. The LuizMelo MCF2 Bat's fly-to-fall transition is a standout example.

When picking a sprite, **check actual animations against this bar** — don't trust marketing screenshots. Download the pack, view the frames in LibreSprite or even a folder preview, and feel whether the motion is alive.

---

## Verdict on the CC0 + rich-animation landscape

LuizMelo's free packs are the only consistent source. Outside them:

- **Sparse-animation CC0 packs are common** (Stealthix, Kenney creatures, most OpenGameArt finds). Plenty of free sprites, few that feel alive.
- **Non-CC0 packs with rich animation exist** (Tiny Swords, Kenmi, Iphigenia) but their licenses block use in a public open-source repo.
- **CC-BY (attribution required) opens a small extra door** — the IDoTheDrawing fox is solid — but doesn't materially expand the catalog vs. just leaning on LuizMelo.

**Pragmatic answer**: pull all of LuizMelo's free packs in one session. That's roughly 8 well-animated creatures with no attribution required, no licensing exposure. Future expansion can come from his paid $5–$8 packs (also CC0 once bought) without changing the workflow. Don't burn time hunting for "the next great free CC0 creator" — it's mostly a flat search space outside this one creator.

---

## Integration recipe

The slime is the reference implementation. For each new LuizMelo (or other) creature:

1. **Add the species code** in `src/shared/types.ts`:
   ```typescript
   export type Species = 'wizard' | 'slime' | 'robot' | 'mimic' | 'bat' | ...;
   ```
2. **Per-species tray crop fraction** in `src/main/index.ts` → `TRAY_HEAD_FRACTION`. Pick a placeholder (e.g., `0.7` for flying creatures, `0.9` for radially-symmetric blobs, `0.5` for humanoid silhouettes). Tune once you see it on a real tray.
3. **Drop the assets** into `assets/sprites/<species>/`:
   - `rotations/south.png` — static fallback (used when no animation matches)
   - `animations/Idle/south/frame_000.png ...` — folder name needs to contain "idle" or "breath" to alias to the renderer's default `'idle'` key
   - `animations/Running/south/frame_000.png ...` — folder name needs to contain "run" to expose `'run'` and `'running'` aliases
4. **File naming inside animation folders**: frames must end in `_NNN.png` (e.g., `frame_000.png`, `frame_001.png`). The scanner sorts by the trailing integer.
5. **Store the raw download** at `assets/sources/<species>/` with a `NOTICE.md` capturing source URL, creator name, exact license, and what was used. See `assets/sources/slime/NOTICE.md` for the template.
6. **Optionally drop scenery** at `assets/sprites/<species>/background.png` for a stage-0 background.

LuizMelo's packs typically ship as a single spritesheet per animation (e.g., `Idle.png` with all frames in one row). Two paths to integrate:

- **Split into individual frame PNGs** using LibreSprite / ImageMagick. Most reliable, drops cleanly into the existing scanner layout.
- **Future enhancement**: extend the sprite manifest scanner to handle spritesheets directly (read frame count from a sibling JSON or filename suffix, slice at render time). Not built yet; track in DIRECTION.md if the manual-split workflow becomes a bottleneck.

## Single-direction is fine

Slime taught us: single-direction sprites work end-to-end. The renderer's `dirs[direction] ?? dirs.south` fallback covers the missing angles, and most creatures are either radially symmetric (slime, mushroom, ghost) or always face the camera (cats, dragons in idle pose) — multi-direction is not a hard requirement for ship.

## Style consistency is not a requirement

The lore is "different species, different aesthetics" — chunky-pixel slime sitting next to soft-pixel wizard is fine. Don't burn time forcing a unified style across the roster; spend that time getting more species in. Once the roster is full enough to be interesting, a future polish pass can choose whether to redraw for consistency or lean into the variety.

## See also

- `DIRECTION.md` → **Deferred / UX polish** — cosmetic art tracking (GandalfHardcore hats with no-resale constraint)
- `HUMAN.md` → **Asset generation** — per-task tracking of cosmetic / background art needs
- `src/main/sprites.ts` — the canonical scanner; treat the comments and direction aliases there as authoritative
- `assets/sources/slime/NOTICE.md` — attribution template
