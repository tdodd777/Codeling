# LuizMelo — Monsters Creatures Fantasy 1 & 2

Source archives for three integrated species (`flying_eye`, `bat`, `mimic`) plus four un-integrated creatures (`goblin`, `skeleton`, `mushroom`, `rat`) preserved for later integration.

## License

Both packs are **CC0 / Public Domain** (verified on the creator's itch.io pages 2026-05-11):

> "This package can be used in commercial and non-commercial projects. Credits are not required, but greatly appreciated!"

No attribution required. Credit listed here for provenance and so future contributors know where assets came from without having to re-discover the pack.

## Source links

- [Monsters Creatures Fantasy](https://luizmelo.itch.io/monsters-creatures-fantasy) — Flying Eye, Goblin, Mushroom, Skeleton (base v1.0 + v1.2 + v1.3 attack updates)
- [Monsters Creatures Fantasy 2](https://luizmelo.itch.io/monsters-creatures-fantasy-2) — Bat, Mimic, Rat, Slime
- [Evil Wizard 2](https://luizmelo.itch.io/evil-wizard-2)
- [Fire Worm](https://luizmelo.itch.io/fire-worm)
- [Martial Hero](https://luizmelo.itch.io/martial-hero)
- [Martial Hero 2](https://luizmelo.itch.io/martial-hero-2)
- [Wizard Pack](https://luizmelo.itch.io/wizard-pack) — no License.txt bundled; treated as CC0 per LuizMelo's consistent practice across his other packs (all of which carry explicit "Creative Commons Zero (CC-0)" License.txt files)

## Source archive contents

This directory contains the raw unmodified ZIP-extracted folders so future work (additional species integrations, re-slicing, etc.) doesn't require re-downloading. Folder names are preserved as-shipped (including the spaces and parens from the creator's naming):

- `Monsters_Creatures_Fantasy/` — MCF1 base
- `Monster_Creatures_Fantasy(Version 1.2)/` — MCF1 second attack additions
- `Monster_Creatures_Fantasy(Version 1.3)/` — MCF1 third attack additions + projectile / weapon sprites
- `Monsters Creatures Fantasy 2/` — full MCF2 with 4 creatures

## How we sliced these

Each LuizMelo spritesheet is a horizontal strip of square frames (e.g., Bat fly.png is 957×87 = 11 frames at 87×87). The slicer at `scripts/luizmelo-slice.py` reads each strip, assumes `frame_width = height`, and writes `frame_NNN.png` files into the PixelLab-style folder layout the manifest scanner expects.

Re-run with `python scripts/luizmelo-slice.py` if you re-unpack the source ZIPs or want to integrate the un-integrated creatures (extend `SPECIES` in the script).

## Currently integrated

| Species | Animations | Total frames |
|---|---|---|
| `flying_eye` | Idle (8) / Attack (8) / Attack2 (8) / Attack3 (6) / Hurt (4) / Death (4) | 38 |
| `bat` | Idle (11) / Attack (11) / Hurt (3) / FlyToFall (3) / Fall (5) / Death (4) | 37 |
| `mimic` | Idle (9) / Walking (6) / Attack (14) / Attack2 (13) / Opening (6) / Transform (7) / IdleClosed (1) / IdleOpen (1) / Hurt (3) / Death (6) | 66 |

## Pending integration

`goblin`, `skeleton`, `mushroom` (MCF1), and `rat` (MCF2) are present in this archive but not yet sliced into `assets/sprites/<species>/`. Add their entries to the `SPECIES` dict in `scripts/luizmelo-slice.py` and re-run to integrate.
