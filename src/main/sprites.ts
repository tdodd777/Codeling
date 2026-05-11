import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { Direction, SpriteManifest, Species } from '@shared/types';

// Accept full names (`north`), short codes (`n`), and hyphenated forms (`north-east`).
const DIRECTION_ALIASES: Record<string, Direction> = {
  n: 'north', north: 'north',
  ne: 'northeast', northeast: 'northeast', 'north-east': 'northeast',
  e: 'east', east: 'east',
  se: 'southeast', southeast: 'southeast', 'south-east': 'southeast',
  s: 'south', south: 'south',
  sw: 'southwest', southwest: 'southwest', 'south-west': 'southwest',
  w: 'west', west: 'west',
  nw: 'northwest', northwest: 'northwest', 'north-west': 'northwest',
};

// Normalize a raw PixelLab animation folder name (e.g., "Breathing_Idle-3c8dc0f6")
// into the canonical key plus any aliases the renderer might ask for.
function animationAliases(rawName: string): string[] {
  const cleaned = rawName.replace(/-[a-f0-9]{6,}$/i, '').toLowerCase();
  const aliases = new Set<string>([cleaned]);
  if (/idle|breath/.test(cleaned)) aliases.add('idle');
  if (/run/.test(cleaned)) aliases.add('run');
  if (/walk/.test(cleaned)) aliases.add('walk');
  if (/attack|cast|fight|hit/.test(cleaned)) aliases.add('attack');
  return [...aliases];
}

// Stable canonical name for a folder — what the shop uses as the unlock id
// suffix (`anim:<species>:<canonicalName>`). Returns one of the friendly
// category names (idle/run/walk/attack) when the folder maps to a known
// category; otherwise the cleaned folder name (e.g., 'death', 'hurt', 'attack2').
// Critical: every folder must map to exactly one canonical name so unlocks +
// pricing + manifest-filtering stay consistent.
export function canonicalAnimationName(rawName: string): string {
  const cleaned = rawName.replace(/-[a-f0-9]{6,}$/i, '').toLowerCase();
  if (/idle|breath/.test(cleaned)) return 'idle';
  if (/^run/.test(cleaned)) return 'run';
  if (/^walk/.test(cleaned)) return 'walk';
  if (/^(attack|cast|fight|hit)$/.test(cleaned)) return 'attack';
  return cleaned;
}

function spritesRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'sprites')
    : path.join(app.getAppPath(), 'assets', 'sprites');
}

export function speciesRoot(species: Species): { dir: string; urlSegments: string[] } {
  return {
    dir: path.join(spritesRoot(), species),
    urlSegments: ['./sprites', species],
  };
}

function urlFor(urlSegments: string[], ...rest: string[]): string {
  return [...urlSegments, ...rest].join('/');
}

function listIfDir(p: string): string[] {
  try {
    return fs.statSync(p).isDirectory() ? fs.readdirSync(p) : [];
  } catch {
    return [];
  }
}

function frameIndex(file: string): number {
  const m = file.match(/_(\d+)\.png$/i);
  return m && m[1] ? parseInt(m[1], 10) : -1;
}

function findBackground(species: Species): string | undefined {
  const file = path.join(spritesRoot(), species, 'background.png');
  try {
    if (fs.statSync(file).isFile()) {
      return ['./sprites', species, 'background.png'].join('/');
    }
  } catch {
    // missing
  }
  return undefined;
}

// Lists the set of canonical animation names available on disk for a species,
// e.g., ['idle', 'run', 'attack', 'attack2', 'death', 'hurt']. Used by the
// animation catalog IPC to populate the shop.
export function listSpeciesAnimations(species: Species): string[] {
  const { dir: root } = speciesRoot(species);
  const names = new Set<string>();
  for (const animFolder of listIfDir(path.join(root, 'animations'))) {
    const animPath = path.join(root, 'animations', animFolder);
    try {
      if (!fs.statSync(animPath).isDirectory()) continue;
    } catch {
      continue;
    }
    names.add(canonicalAnimationName(animFolder));
  }
  // Flat-layout (no animations/ subdir): every subdir of the species root is
  // an animation when it isn't a known structural folder.
  if (!fs.existsSync(path.join(root, 'animations'))) {
    for (const entry of listIfDir(root)) {
      if (entry === 'rotations' || entry === 'metadata.json') continue;
      try {
        if (fs.statSync(path.join(root, entry)).isDirectory()) {
          names.add(canonicalAnimationName(entry));
        }
      } catch {
        // skip
      }
    }
  }
  return [...names];
}

// `unlocked`: when provided, the scanner skips animation folders whose
// canonical name isn't in the set. `idle` and `static` always pass through —
// they're the always-free baseline that every owned species ships with.
export function buildSpriteManifest(species: Species, unlocked?: ReadonlySet<string>): SpriteManifest {
  const { dir: root, urlSegments } = speciesRoot(species);
  const manifest: SpriteManifest = {
    static: urlFor(urlSegments, 'rotations', 'south.png'),
    animations: {},
  };
  const background = findBackground(species);
  if (background) manifest.background = background;

  if (!fs.existsSync(root)) {
    console.warn(`[sprites] no sprite directory for ${species} at ${root}`);
    return manifest;
  }

  const isUnlocked = (folderName: string): boolean => {
    if (!unlocked) return true;
    const canonical = canonicalAnimationName(folderName);
    if (canonical === 'idle') return true; // always free
    return unlocked.has(canonical);
  };

  // 1. rotations/ — single-frame static images per direction.
  for (const file of listIfDir(path.join(root, 'rotations'))) {
    if (!file.toLowerCase().endsWith('.png')) continue;
    const base = file.replace(/\.png$/i, '').toLowerCase();
    const direction = DIRECTION_ALIASES[base];
    if (!direction) continue;
    if (direction === 'south') {
      manifest.static = urlFor(urlSegments, 'rotations', file);
    }
    // Expose rotations as a 1-frame "static" pseudo-animation so renderers can
    // request a still pose by direction without special-casing.
    const anim = (manifest.animations.static ??= {});
    anim[direction] = [urlFor(urlSegments, 'rotations', file)];
  }

  // 2. animations/<name-hash>/<direction>/frame_NNN.png — PixelLab format.
  for (const animFolder of listIfDir(path.join(root, 'animations'))) {
    const animPath = path.join(root, 'animations', animFolder);
    if (!fs.statSync(animPath).isDirectory()) continue;
    if (!isUnlocked(animFolder)) continue;

    const directions: Partial<Record<Direction, string[]>> = {};
    for (const dirName of listIfDir(animPath)) {
      const dirPath = path.join(animPath, dirName);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      const direction = DIRECTION_ALIASES[dirName.toLowerCase()];
      if (!direction) continue;
      const frames = listIfDir(dirPath)
        .filter((f) => f.toLowerCase().endsWith('.png'))
        .sort((a, b) => frameIndex(a) - frameIndex(b))
        .map((f) => urlFor(urlSegments, 'animations', animFolder, dirName, f));
      if (frames.length > 0) directions[direction] = frames;
    }

    if (Object.keys(directions).length > 0) {
      for (const alias of animationAliases(animFolder)) {
        manifest.animations[alias] = directions;
      }
    }
  }

  // 3. Backwards-compat: flat layout (<animation>/<direction>_<frame>.png).
  for (const entry of listIfDir(root)) {
    if (entry === 'rotations' || entry === 'animations' || entry === 'metadata.json') continue;
    const dir = path.join(root, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (!isUnlocked(entry)) continue;
    const directions: Partial<Record<Direction, string[]>> = {};
    for (const file of listIfDir(dir)) {
      if (!file.toLowerCase().endsWith('.png')) continue;
      const m = file.replace(/\.png$/i, '').match(/^([a-z-]+?)(?:_(\d+))?$/i);
      if (!m || !m[1]) continue;
      const direction = DIRECTION_ALIASES[m[1].toLowerCase()];
      if (!direction) continue;
      (directions[direction] ??= []).push(urlFor(urlSegments, entry, file));
    }
    for (const dir of Object.keys(directions) as Direction[]) {
      directions[dir]!.sort((a, b) => frameIndex(a) - frameIndex(b));
    }
    if (Object.keys(directions).length > 0) {
      manifest.animations[entry.toLowerCase()] = directions;
    }
  }

  const summary = Object.entries(manifest.animations)
    .map(
      ([name, dirs]) =>
        `${name}(${Object.entries(dirs)
          .map(([d, fs]) => `${d}=${fs.length}`)
          .join(',')})`,
    )
    .join(' ');
  console.log(`[sprites] ${species}: ${summary || '(only static fallback)'}`);

  return manifest;
}
