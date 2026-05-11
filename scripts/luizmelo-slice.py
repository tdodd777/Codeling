"""LuizMelo Monsters Creatures Fantasy → Codeling sprite layout slicer.

Each LuizMelo spritesheet is a horizontal strip of square frames. This script
slices those strips into per-frame PNGs and lays them out under
`assets/sprites/<species>/animations/<anim>/south/frame_NNN.png`, matching the
PixelLab-style layout that the manifest scanner in `src/main/sprites.ts`
already understands.

Re-run anytime the source ZIPs are re-unpacked; output is overwritten.

Source dirs (relative to ASSETS): see SOURCES below.
"""
from __future__ import annotations
import os
import sys
import shutil
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).parent.parent / "assets"
SPRITES = ASSETS / "sprites"
SOURCES_ARCHIVE = ASSETS / "sources"

# Source archives live under assets/sources/luizmelo/. If you re-unpack a pack
# under assets/sprites/ instead, this script also looks there as a fallback.
def _resolve(name: str) -> Path:
    archived = SOURCES_ARCHIVE / "luizmelo" / name
    if archived.is_dir():
        return archived
    return SPRITES / name  # fallback for freshly-unzipped state

MCF1_BASE = _resolve("Monsters_Creatures_Fantasy") / "Monsters_Creatures_Fantasy"
MCF1_V12 = _resolve("Monster_Creatures_Fantasy(Version 1.2)") / "Monster_Creatures_Fantasy(Version 1.2)"
MCF1_V13 = _resolve("Monster_Creatures_Fantasy(Version 1.3)") / "Monster_Creatures_Fantasy(Version 1.3)"
MCF2 = _resolve("Monsters Creatures Fantasy 2") / "Monsters Creatures Fantasy 2"

# Sidescroller-style packs from the same creator (LuizMelo). Each ships a flat
# Sprites/ directory with one PNG per animation. Fire Worm has a nested
# Sprites/Worm/ folder for the creature (with separate Fire Ball/ projectile).
EVIL_WIZARD = _resolve("EVil Wizard 2") / "EVil Wizard 2" / "Sprites"
FIRE_WORM = _resolve("Fire Worm") / "Fire Worm" / "Sprites" / "Worm"
MARTIAL_HERO = _resolve("Martial Hero") / "Martial Hero" / "Sprites"
MARTIAL_HERO_2 = _resolve("Martial Hero 2") / "Martial Hero 2" / "Sprites"
WIZARD_PACK = _resolve("Wizard Pack") / "Wizard Pack"

# Per-species integration plan.
# Each entry is: (source_creature_dir, dest_anim_folder, source_filename)
# The first entry must be the one used for the static fallback (rotations/south.png).
SPECIES = {
    "flying_eye": {
        "label": "Flying Eye",
        "license_pack": "MCF1",
        "source_creature_subdir": "Flying eye",
        "animations": [
            # (source_root, dest_folder, src_filename)
            (MCF1_BASE, "Idle",    "Flight.png"),   # Flight serves as idle for a flying creature
            (MCF1_BASE, "Attack",  "Attack.png"),
            (MCF1_V12,  "Attack2", "Attack2.png"),
            (MCF1_V13,  "Attack3", "Attack3.png"),
            (MCF1_BASE, "Hurt",    "Take Hit.png"),
            (MCF1_BASE, "Death",   "Death.png"),
        ],
    },
    "bat": {
        "label": "Bat",
        "license_pack": "MCF2",
        "source_creature_subdir": "Bat",
        "animations": [
            (MCF2, "Idle",       "fly.png"),
            (MCF2, "Attack",     "attack.png"),
            (MCF2, "Hurt",       "hurt.png"),
            (MCF2, "FlyToFall",  "fly-to-fall.png"),
            (MCF2, "Fall",       "fall.png"),
            (MCF2, "Death",      "death.png"),
        ],
    },
    "mimic": {
        "label": "Mimic",
        "license_pack": "MCF2",
        "source_creature_subdir": "Mimic",
        "animations": [
            (MCF2, "Idle",         "idle_transformed.png"),  # the alive form, 9 frames
            (MCF2, "Walking",      "walk.png"),               # 6 frames
            (MCF2, "Attack",       "attack_1.png"),
            (MCF2, "Attack2",      "attack_2.png"),
            (MCF2, "Opening",      "opening.png"),
            (MCF2, "Transform",    "transform.png"),
            # 1-frame static poses — rename to avoid colliding with the 'idle' alias.
            # The scanner aliases anything matching /idle|breath/ to 'idle', so
            # IdleClosed/IdleOpen would overwrite the real 9-frame Idle.
            (MCF2, "ChestClosed",  "Idle_closed.png"),
            (MCF2, "ChestOpen",    "idle_open.png"),
            (MCF2, "Hurt",         "hurt.png"),
            (MCF2, "Death",        "death.png"),
        ],
    },
    # Sidescroller humanoid characters — single-direction, flat Sprites/ layout.
    # Note: these are humanoid sprites, not creature-like — lower pet vibe but
    # very high animation quality. The user wanted them in the roster.
    "evil_wizard": {
        "label": "Evil Wizard",
        "license_pack": "Evil Wizard 2 (CC0)",
        "source_creature_subdir": ".",
        "animations": [
            (EVIL_WIZARD, "Idle",    "Idle.png"),
            (EVIL_WIZARD, "Running", "Run.png"),
            (EVIL_WIZARD, "Jump",    "Jump.png"),
            (EVIL_WIZARD, "Fall",    "Fall.png"),
            (EVIL_WIZARD, "Attack",  "Attack1.png"),
            (EVIL_WIZARD, "Attack2", "Attack2.png"),
            (EVIL_WIZARD, "Hurt",    "Take hit.png"),
            (EVIL_WIZARD, "Death",   "Death.png"),
        ],
    },
    "fire_worm": {
        "label": "Fire Worm",
        "license_pack": "Fire Worm (CC0)",
        "source_creature_subdir": ".",
        "animations": [
            (FIRE_WORM, "Idle",    "Idle.png"),
            (FIRE_WORM, "Walking", "Walk.png"),
            (FIRE_WORM, "Attack",  "Attack.png"),
            (FIRE_WORM, "Hurt",    "Get Hit.png"),
            (FIRE_WORM, "Death",   "Death.png"),
        ],
    },
    "martial_hero": {
        "label": "Martial Hero",
        "license_pack": "Martial Hero (CC0)",
        "source_creature_subdir": ".",
        "animations": [
            (MARTIAL_HERO, "Idle",    "Idle.png"),
            (MARTIAL_HERO, "Running", "Run.png"),
            (MARTIAL_HERO, "Jump",    "Jump.png"),
            (MARTIAL_HERO, "Fall",    "Fall.png"),
            (MARTIAL_HERO, "Attack",  "Attack1.png"),
            (MARTIAL_HERO, "Attack2", "Attack2.png"),
            (MARTIAL_HERO, "Hurt",    "Take Hit.png"),
            (MARTIAL_HERO, "Death",   "Death.png"),
        ],
    },
    "martial_hero_2": {
        "label": "Martial Hero 2",
        "license_pack": "Martial Hero 2 (CC0)",
        "source_creature_subdir": ".",
        "animations": [
            (MARTIAL_HERO_2, "Idle",    "Idle.png"),
            (MARTIAL_HERO_2, "Running", "Run.png"),
            (MARTIAL_HERO_2, "Jump",    "Jump.png"),
            (MARTIAL_HERO_2, "Fall",    "Fall.png"),
            (MARTIAL_HERO_2, "Attack",  "Attack1.png"),
            (MARTIAL_HERO_2, "Attack2", "Attack2.png"),
            (MARTIAL_HERO_2, "Hurt",    "Take hit.png"),
            (MARTIAL_HERO_2, "Death",   "Death.png"),
        ],
    },
    "goblin": {
        "label": "Goblin",
        "license_pack": "MCF1",
        "source_creature_subdir": "Goblin",
        "animations": [
            (MCF1_BASE, "Idle",    "Idle.png"),
            (MCF1_BASE, "Running", "Run.png"),
            (MCF1_BASE, "Attack",  "Attack.png"),
            (MCF1_V12,  "Attack2", "Attack2.png"),
            (MCF1_V13,  "Attack3", "Attack3.png"),
            (MCF1_BASE, "Hurt",    "Take Hit.png"),
            (MCF1_BASE, "Death",   "Death.png"),
        ],
    },
    "skeleton": {
        "label": "Skeleton",
        "license_pack": "MCF1",
        "source_creature_subdir": "Skeleton",
        "animations": [
            (MCF1_BASE, "Idle",    "Idle.png"),
            (MCF1_BASE, "Walking", "Walk.png"),
            (MCF1_BASE, "Attack",  "Attack.png"),
            (MCF1_V12,  "Attack2", "Attack2.png"),
            (MCF1_V13,  "Attack3", "Attack3.png"),
            (MCF1_BASE, "Shield",  "Shield.png"),
            (MCF1_BASE, "Hurt",    "Take Hit.png"),
            (MCF1_BASE, "Death",   "Death.png"),
        ],
    },
    "mushroom": {
        "label": "Mushroom",
        "license_pack": "MCF1",
        "source_creature_subdir": "Mushroom",
        "animations": [
            (MCF1_BASE, "Idle",    "Idle.png"),
            (MCF1_BASE, "Running", "Run.png"),
            (MCF1_BASE, "Attack",  "Attack.png"),
            (MCF1_V12,  "Attack2", "Attack2.png"),
            (MCF1_V13,  "Attack3", "Attack3.png"),
            (MCF1_BASE, "Hurt",    "Take Hit.png"),
            (MCF1_BASE, "Death",   "Death.png"),
        ],
    },
    "rat": {
        "label": "Rat",
        "license_pack": "MCF2",
        "source_creature_subdir": "Rat",
        "animations": [
            (MCF2, "Idle",    "idle.png"),
            (MCF2, "Running", "run.png"),
            (MCF2, "Attack",  "attack_bite.png"),
            (MCF2, "Hurt",    "hurt.png"),
            (MCF2, "Death",   "rat-death.png"),
        ],
    },
    "apprentice_wizard": {
        # LuizMelo's standalone "Wizard Pack" — distinct from the PixelLab
        # wizard already in the project. No License.txt bundled with the pack,
        # but per LuizMelo's consistent CC0 practice across all his free packs
        # we treat it as CC0; flag if a hard license-check ever blocks shipping.
        # Note: this pack uses NON-SQUARE frames (231x190 — wider than tall).
        # The fourth tuple element is the explicit frame count per anim to
        # override the slicer's default square-frame heuristic. Without these,
        # the wizard's content drifts laterally across slices.
        "label": "Apprentice Wizard",
        "license_pack": "Wizard Pack (CC0 inferred — no LICENSE.txt bundled)",
        "source_creature_subdir": ".",
        "animations": [
            (WIZARD_PACK, "Idle",    "Idle.png",    6),
            (WIZARD_PACK, "Running", "Run.png",     8),
            (WIZARD_PACK, "Jump",    "Jump.png",    2),
            (WIZARD_PACK, "Fall",    "Fall.png",    2),
            (WIZARD_PACK, "Attack",  "Attack1.png", 8),
            (WIZARD_PACK, "Attack2", "Attack2.png", 8),
            (WIZARD_PACK, "Hurt",    "Hit.png",     4),
            (WIZARD_PACK, "Death",   "Death.png",   7),
        ],
    },
}


def slice_strip_in_memory(image_path: Path, frame_count: int | None = None) -> list:
    """Slice a horizontal sprite strip into N PIL frames (no disk write).

    Most LuizMelo packs use square frames (frame_w = height), but some (e.g.,
    the standalone Wizard Pack) use wider non-square frames. Pass an explicit
    `frame_count` to force the slicer to compute `frame_w = total_w / count`;
    otherwise it falls back to the square-frame heuristic.
    """
    frames = []
    with Image.open(image_path) as im:
        im = im.convert("RGBA")
        w, h = im.size
        if h == 0:
            return frames
        if frame_count and frame_count > 0:
            frame_w = w // frame_count
            count = frame_count
        else:
            frame_w = h
            count = max(1, w // frame_w)
        for i in range(count):
            frames.append(im.crop((i * frame_w, 0, (i + 1) * frame_w, h)))
    return frames


def union_bbox(frames: list, padding: int = 4) -> tuple:
    """Compute the union bounding box of all non-transparent pixels across the
    given frames, then expand it to a square (center-padded on the shorter
    dimension) so the cropped frames render correctly in the renderer's square
    `<img>` box without aspect-ratio distortion. Pads by N pixels on each side
    (clamped to source frame bounds)."""
    x0 = y0 = float("inf")
    x1 = y1 = float("-inf")
    fw = fh = 0
    for f in frames:
        fw, fh = f.size
        bb = f.getbbox()  # alpha-channel-aware bbox of non-transparent content
        if bb is None:
            continue
        x0 = min(x0, bb[0])
        y0 = min(y0, bb[1])
        x1 = max(x1, bb[2])
        y1 = max(y1, bb[3])
    if x0 == float("inf"):
        return (0, 0, fw, fh)
    x0, y0, x1, y1 = int(x0) - padding, int(y0) - padding, int(x1) + padding, int(y1) + padding

    # Expand to square so the cropped output keeps its aspect ratio when the
    # renderer stretches it into a square <img>. Center-expand the shorter dim.
    bw, bh = x1 - x0, y1 - y0
    target = max(bw, bh)
    if bw < target:
        extra = target - bw
        x0 -= extra // 2
        x1 += extra - (extra // 2)
    elif bh < target:
        extra = target - bh
        y0 -= extra // 2
        y1 += extra - (extra // 2)

    # Clamp to source frame bounds, then re-pad opposite side if clamping cut
    # in (so we stay square even at the edge of the source frame).
    if x0 < 0:
        x1 += -x0; x0 = 0
    if y0 < 0:
        y1 += -y0; y0 = 0
    if x1 > fw:
        x0 -= (x1 - fw); x1 = fw
    if y1 > fh:
        y0 -= (y1 - fh); y1 = fh
    return (max(0, x0), max(0, y0), min(fw, x1), min(fh, y1))


def integrate_species(species: str, plan: dict) -> None:
    dest = SPRITES / species
    if dest.exists():
        shutil.rmtree(dest)
    (dest / "rotations").mkdir(parents=True)
    (dest / "animations").mkdir(parents=True)

    # Phase 1: slice every animation into in-memory PIL frames.
    # Animation tuples are (source_root, dest_folder, src_filename) or
    # (source_root, dest_folder, src_filename, frame_count) — the optional
    # fourth element forces non-square frame width.
    all_anims: dict[str, list] = {}
    for entry in plan["animations"]:
        source_root, dest_anim, src_file, *rest = entry
        frame_count = rest[0] if rest else None
        src_path = source_root / plan["source_creature_subdir"] / src_file
        if not src_path.is_file():
            print(f"  [WARN] missing: {src_path}")
            continue
        all_anims[dest_anim] = slice_strip_in_memory(src_path, frame_count)

    # Phase 2: compute PER-ANIMATION bbox so each animation crops tight to its
    # own content. Cost: perceived scale jumps when switching between anims
    # (e.g., Idle creature looks bigger than Attack creature because Attack
    # extends limbs/tongues outward). Acceptable today since the renderer only
    # plays Idle. Revisit (species-wide bbox) when multi-anim playback lands.
    anim_bboxes = {name: union_bbox(frames, padding=4) for name, frames in all_anims.items()}

    # Phase 3: crop each frame to its per-anim bbox and write to disk.
    summary: list[str] = []
    first = True
    for dest_anim, frames in all_anims.items():
        bbox = anim_bboxes[dest_anim]
        out_dir = dest / "animations" / dest_anim / "south"
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(frames):
            f.crop(bbox).save(out_dir / f"frame_{i:03d}.png")
        summary.append(f"{dest_anim}={len(frames)}@{bbox[2]-bbox[0]}x{bbox[3]-bbox[1]}")
        if first:
            # Static fallback = frame 0 of the first listed animation.
            shutil.copy(out_dir / "frame_000.png", dest / "rotations" / "south.png")
            first = False
    print(f"  [ok] {species}: {', '.join(summary)}")


def archive_sources_and_cleanup() -> None:
    """Move the LuizMelo source folders out of sprites/ into sources/ so the
    scanner doesn't trip over them, and the originals are preserved for re-extraction."""
    archive_dir = SOURCES_ARCHIVE / "luizmelo"
    archive_dir.mkdir(parents=True, exist_ok=True)
    moved = []
    for src in [
        SPRITES / "Monsters_Creatures_Fantasy",
        SPRITES / "Monster_Creatures_Fantasy(Version 1.2)",
        SPRITES / "Monster_Creatures_Fantasy(Version 1.3)",
        SPRITES / "Monsters Creatures Fantasy 2",
        SPRITES / "EVil Wizard 2",
        SPRITES / "Fire Worm",
        SPRITES / "Martial Hero",
        SPRITES / "Martial Hero 2",
        SPRITES / "Wizard Pack",
    ]:
        if src.exists():
            target = archive_dir / src.name
            if target.exists():
                shutil.rmtree(target)
            shutil.move(str(src), str(target))
            moved.append(src.name)
    if moved:
        print(f"  archived: {len(moved)} pack(s) -> assets/sources/luizmelo/")


def main() -> None:
    print("=== LuizMelo slicer ===")
    for species, plan in SPECIES.items():
        integrate_species(species, plan)
    archive_sources_and_cleanup()
    print("done.")


if __name__ == "__main__":
    main()
