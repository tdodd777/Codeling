# Slime sprite source

- **Source**: https://rvros.itch.io/pixel-art-animated-slime
- **Creator**: rvros (itch.io)
- **License**: CC0 / public domain — no attribution required, but credited here for provenance
- **Original size**: 32×25 px per frame, single-direction (mirror for left/right)

## What we used

Idle (4 frames) and move (4 frames) extracted into Codeling's PixelLab-compatible sprite layout at `assets/sprites/slime/`:

- `rotations/south.png` ← copy of `slime-idle-0.png` (static fallback)
- `animations/Idle/south/frame_000–003.png` ← rvros idle frames
- `animations/Running/south/frame_000–003.png` ← rvros move frames

Attack / die / hurt frames are kept in this `source/` archive but not wired into the game today.

## Re-extracting

The master spritesheet (`slime-Sheet.png`) plus the per-frame Individual Sprites are preserved here so future evolution stages or additional animations can be derived without re-downloading.
