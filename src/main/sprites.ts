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

function spritesRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'sprites')
    : path.join(app.getAppPath(), 'assets', 'sprites');
}

// Resolve the sprite directory + URL prefix for a species at a given evolution
// stage. If `stage_<N>/` exists under the species, use it; otherwise fall back
// to the species root so a freshly-evolved pet without per-stage art still
// renders the previous form rather than going invisible.
export function speciesStageRoot(
  species: Species,
  stage: number,
): { dir: string; urlSegments: string[] } {
  const base = path.join(spritesRoot(), species);
  if (stage > 0) {
    const stageDir = path.join(base, `stage_${stage}`);
    try {
      if (fs.statSync(stageDir).isDirectory()) {
        return { dir: stageDir, urlSegments: ['./sprites', species, `stage_${stage}`] };
      }
    } catch {
      // stage dir missing — fall through to root
    }
  }
  return { dir: base, urlSegments: ['./sprites', species] };
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

// Scenery background lives next to rotations/animations as a single PNG. Stage-
// specific scenery wins over the species default — e.g., stage_2/background.png
// (archmage tower) overrides background.png (apprentice quarters) once the pet
// has evolved that far.
function findBackground(species: Species, stage: number): string | undefined {
  const candidates: { dir: string; segments: string[] }[] = [];
  if (stage > 0) {
    candidates.push({
      dir: path.join(spritesRoot(), species, `stage_${stage}`),
      segments: ['./sprites', species, `stage_${stage}`],
    });
  }
  candidates.push({
    dir: path.join(spritesRoot(), species),
    segments: ['./sprites', species],
  });
  for (const c of candidates) {
    const file = path.join(c.dir, 'background.png');
    try {
      if (fs.statSync(file).isFile()) {
        return [...c.segments, 'background.png'].join('/');
      }
    } catch {
      // missing — try next
    }
  }
  return undefined;
}

export function buildSpriteManifest(species: Species, stage = 0): SpriteManifest {
  const { dir: root, urlSegments } = speciesStageRoot(species, stage);
  const manifest: SpriteManifest = {
    static: urlFor(urlSegments, 'rotations', 'south.png'),
    animations: {},
    cosmeticOverlays: {},
  };
  const background = findBackground(species, stage);
  if (background) manifest.background = background;

  if (!fs.existsSync(root)) {
    console.warn(`[sprites] no sprite directory for ${species} stage ${stage} at ${root}`);
    return manifest;
  }

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
    if (entry === 'rotations' || entry === 'animations' || entry === 'cosmetics' || entry === 'metadata.json') continue;
    if (/^stage_\d+$/.test(entry)) continue; // stage subdirs are scanned via their own buildSpriteManifest call
    const dir = path.join(root, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
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

  // 4. cosmetics/<cosmeticId>/<direction>.png — equipped overlay sprites.
  // Same direction-aliasing rules as rotations/ (south.png, etc.). Renderer
  // composites the matching direction over the base sprite when the player
  // equips this cosmetic.
  const cosmeticsRoot = path.join(root, 'cosmetics');
  for (const id of listIfDir(cosmeticsRoot)) {
    const idDir = path.join(cosmeticsRoot, id);
    try {
      if (!fs.statSync(idDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const dirs: Partial<Record<Direction, string>> = {};
    for (const file of listIfDir(idDir)) {
      if (!file.toLowerCase().endsWith('.png')) continue;
      const base = file.replace(/\.png$/i, '').toLowerCase();
      const direction = DIRECTION_ALIASES[base];
      if (!direction) continue;
      dirs[direction] = urlFor(urlSegments, 'cosmetics', id, file);
    }
    if (Object.keys(dirs).length > 0) manifest.cosmeticOverlays[id] = dirs;
  }

  const summary = Object.entries(manifest.animations)
    .map(
      ([name, dirs]) =>
        `${name}(${Object.entries(dirs)
          .map(([d, fs]) => `${d}=${fs.length}`)
          .join(',')})`,
    )
    .join(' ');
  console.log(`[sprites] ${species} stage ${stage}: ${summary || '(only static fallback)'}`);

  return manifest;
}
