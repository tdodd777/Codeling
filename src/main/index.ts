import { app, nativeImage, Notification, type NativeImage } from 'electron';
import { menubar } from 'menubar';
import path from 'node:path';
import fs from 'node:fs';
import type { Species } from '@shared/types';
import { evaluateAchievements } from './achievements';
import { initAutoUpdater } from './auto-updater';
import { maybeShowDailySummary } from './daily-summary';
import { getDb, closeDb } from './db/client';
import { getPet } from './db/repos';
import { events } from './events';
import { registerIpcHandlers } from './ipc';
import { getTelemetryEnabled, startReceivers } from './otel/lifecycle';
import { initPopout } from './popout';

const TRAY_TARGET_PX = 40;
const TRAY_FPS = 4;

// Per-species head-crop fraction. Humanoid silhouettes (wizard) read well as
// just hat + face; rounder pets (slime) need more body in frame; mechanical
// pets (robot) tend to have the most distinctive feature lower down so we
// take the whole sprite.
//
// Tune once each species' real art lands — the slime/robot values are
// placeholders, picked so the tray scan won't break before you can iterate.
const TRAY_HEAD_FRACTION: Record<Species, number> = {
  wizard: 0.55,
  slime: 0.85,
  robot: 1.0,
  // LuizMelo creatures — all single-direction, soft pixel art, placeholders to tune
  // once each species is seen on a real tray icon at native size.
  flying_eye: 0.9,         // mostly head (eye monster), head crop is the whole sprite
  bat: 0.7,                // wings + body; keep enough body in frame to read "bat"
  mimic: 0.65,             // chest with mouth on top — top crop catches the alive bits
  evil_wizard: 0.5,        // humanoid, hat + face survives the tray crop
  fire_worm: 0.8,          // worm with mostly body — head fraction is most of the sprite
  martial_hero: 0.5,       // humanoid kung-fu fighter
  martial_hero_2: 0.5,     // same
  apprentice_wizard: 0.5,  // humanoid, pointy hat reads
  goblin: 0.55,            // small humanoid, head crop keeps face + ears
  skeleton: 0.5,           // humanoid skeleton, classic head-up silhouette
  mushroom: 0.65,          // most of the silhouette is cap — keep more in frame
  rat: 0.7,                // creature, mostly head + body length
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

function assetsRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(app.getAppPath(), 'assets');
}

// PixelLab sprites are painted into a generous transparent canvas; cropping to
// the visible bounding box reclaims the wasted pixels so the character actually
// fills the ~16-32px tray slot instead of becoming a barely-visible dot.
function cropToContent(img: NativeImage, alphaThreshold = 16, padding = 1): NativeImage {
  const { width, height } = img.getSize();
  if (width === 0 || height === 0) return img;
  const buf = img.toBitmap();
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = buf[(y * width + x) * 4 + 3] ?? 0;
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return img; // fully transparent — bail
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const w = Math.min(width - x, maxX - minX + 1 + 2 * padding);
  const h = Math.min(height - y, maxY - minY + 1 + 2 * padding);
  return img.crop({ x, y, width: w, height: h });
}

// Take the top `fraction` of the image's height — for humanoid sprites this
// gets us hat + head + shoulders, which is what survives readably at 16-22px.
function takeTop(img: NativeImage, fraction: number): NativeImage {
  const { width, height } = img.getSize();
  if (width === 0 || height === 0) return img;
  const h = Math.max(1, Math.round(height * fraction));
  return img.crop({ x: 0, y: 0, width, height: h });
}

function processForTray(img: NativeImage, species: Species): NativeImage {
  // 1. Crop the source to its visible bounding box (PixelLab pads heavily).
  // 2. Take the top fraction tuned for the species silhouette — Windows tray
  //    slot is too small to read a full humanoid body, but a slime is mostly
  //    head, and a robot's body is its most distinctive bit.
  // 3. Re-crop content in case the top portion introduced new whitespace
  //    (e.g., a peaked hat with empty shoulders below it).
  // 4. Resize so the longest dim hits TRAY_TARGET_PX, preserving aspect.
  const fraction = TRAY_HEAD_FRACTION[species] ?? 0.55;
  const headOnly = cropToContent(takeTop(cropToContent(img), fraction));
  if (process.platform !== 'win32') return headOnly;
  const { width: cw, height: ch } = headOnly.getSize();
  const ratio = TRAY_TARGET_PX / Math.max(cw, ch, 1);
  return headOnly.resize({
    width: Math.max(1, Math.round(cw * ratio)),
    height: Math.max(1, Math.round(ch * ratio)),
    quality: 'best',
  });
}

// Resolve the on-disk sprite root for a species. Mirrors the renderer-side
// `speciesRoot` (sprites.ts).
function spriteDir(species: Species): string {
  return path.join(assetsRoot(), 'sprites', species);
}

function trayIcon(): NativeImage {
  // Prefer the current pet's south rotation so the tray reflects what's in the panel.
  try {
    const pet = getPet();
    const root = spriteDir(pet.species);
    const speciesIcon = path.join(root, 'rotations', 'south.png');
    if (fs.existsSync(speciesIcon)) {
      return processForTray(nativeImage.createFromPath(speciesIcon), pet.species);
    }
  } catch {
    // Pet row not seeded yet — fall through to brand placeholder.
  }

  // Fallback: standalone tray-icon files (Template suffix triggers macOS auto-inversion).
  const file = process.platform === 'darwin' ? 'tray-icon-Template.png' : 'tray-icon.png';
  const full = path.join(assetsRoot(), file);
  return fs.existsSync(full) ? nativeImage.createFromPath(full) : nativeImage.createEmpty();
}

// Pre-render every idle frame at boot so the animation loop is just an array swap,
// not a disk read + decode + crop on each tick.
function buildIdleTrayFrames(species: Species): NativeImage[] {
  const animDir = path.join(spriteDir(species), 'animations');
  if (!fs.existsSync(animDir)) return [];
  const idleFolder = fs
    .readdirSync(animDir)
    .find((name) => /idle|breath/i.test(name));
  if (!idleFolder) return [];
  const southDir = path.join(animDir, idleFolder, 'south');
  if (!fs.existsSync(southDir)) return [];
  const files = fs
    .readdirSync(southDir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort();
  return files.map((f) => processForTray(nativeImage.createFromPath(path.join(southDir, f)), species));
}

function rendererIndex(): string {
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return MAIN_WINDOW_VITE_DEV_SERVER_URL;
  }
  return `file://${path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`;
}

function preloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

async function bootstrap() {
  await app.whenReady();

  if (process.platform === 'darwin') {
    app.dock?.hide();
  }

  // Initialize SQLite (creates DB and seeds on first boot).
  getDb();
  // Backfill any achievements an existing save already qualifies for, silently
  // — without this an upgraded user would get a burst of OS notifications on
  // their next ingest tick for everything they've already earned over time.
  evaluateAchievements(true);
  // Show yesterday's recap on first launch each local day. Cheap idempotent
  // check; safe to call from boot even if we'll also call from ingest.
  maybeShowDailySummary();
  registerIpcHandlers();

  // Honor the persisted telemetry-enabled flag. Default ON; the Settings
  // toggle flips this. Failures inside startReceivers don't throw — they log.
  if (getTelemetryEnabled()) {
    startReceivers();
  } else {
    console.log('[otel] receivers not started — telemetry disabled in Settings');
  }

  initAutoUpdater();

  // Tooltip shows the pet's name so the user can identify which pet is theirs
  // when multiple Codeling-style apps live in the tray. Falls back to brand if
  // pet row isn't ready (first run before seed completes).
  let initialTooltip = 'Codeling';
  try {
    initialTooltip = `Codeling — ${getPet().name}`;
  } catch {
    // pet not seeded yet
  }

  const mb = menubar({
    index: rendererIndex(),
    icon: trayIcon(),
    tooltip: initialTooltip,
    showDockIcon: false,
    preloadWindow: true,
    browserWindow: {
      width: 380,
      height: 560,
      transparent: false,
      resizable: false,
      webPreferences: {
        preload: preloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    },
  });

  mb.on('ready', () => {
    console.log('[codeling] menubar ready');
    if (!app.isPackaged) {
      mb.window?.webContents.openDevTools({ mode: 'detach' });
    }
    startTrayAnimation();
    initPopout({ mb, rendererUrl: rendererIndex(), preloadPath: preloadPath() });
  });

  mb.on('after-create-window', () => {
    if (!app.isPackaged) {
      mb.window?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  let trayTimer: NodeJS.Timeout | null = null;
  // Last species we rendered into the tray, so the drift poll below can
  // detect a divergence between DB state and rendered state. Updated at the
  // end of every successful startTrayAnimation call.
  let lastTrayedSpecies: Species | null = null;

  function startTrayAnimation() {
    if (trayTimer) {
      clearInterval(trayTimer);
      trayTimer = null;
    }
    let species: Species;
    try {
      species = getPet().species;
    } catch {
      return;
    }
    // Refresh the static icon first so a species swap lands visibly even
    // when the new species has only a still rotation and no idle frames.
    if (mb.tray && !mb.tray.isDestroyed()) {
      mb.tray.setImage(trayIcon());
    }
    lastTrayedSpecies = species;
    const frames = buildIdleTrayFrames(species);
    if (frames.length <= 1) return; // no animation available — keep static icon
    console.log(`[tray] animating ${frames.length} idle frames at ${TRAY_FPS} fps (${species})`);
    let i = 0;
    trayTimer = setInterval(() => {
      if (!mb.tray || mb.tray.isDestroyed()) {
        if (trayTimer) {
          clearInterval(trayTimer);
          trayTimer = null;
        }
        return;
      }
      mb.tray.setImage(frames[i % frames.length]!);
      i++;
    }, Math.round(1000 / TRAY_FPS));
  }

  // Drift backstop. The production paths emit pet:species-changed / pet:reset
  // and the tray refreshes immediately. Direct DB writes (test paths,
  // hypothetical future save-import code that doesn't emit) bypass that. A
  // cheap 5s poll catches drift between the rendered species and current
  // DB state and refreshes. Tiny single-row query; the interval is unref'd
  // so it doesn't keep the process alive at quit.
  const TRAY_DRIFT_POLL_MS = 5000;
  const driftPoll = setInterval(() => {
    let current: Species;
    try {
      current = getPet().species;
    } catch {
      return;
    }
    if (lastTrayedSpecies !== null && current !== lastTrayedSpecies) {
      console.log(`[tray] species drifted ${lastTrayedSpecies} → ${current}; refreshing`);
      startTrayAnimation();
    }
  }, TRAY_DRIFT_POLL_MS);
  if (typeof driftPoll.unref === 'function') driftPoll.unref();

  events.on('pet:species-changed', (e) => {
    console.log(`[tray] active species changed → ${e.species}; refreshing`);
    startTrayAnimation();
  });

  events.on('pet:reset', () => {
    console.log('[tray] save reset; refreshing tray');
    startTrayAnimation();
  });

  events.on('pet:renamed', (e) => {
    if (mb.tray && !mb.tray.isDestroyed()) {
      mb.tray.setToolTip(`Codeling — ${e.name}`);
    }
  });

  events.on('achievement:earned', (a) => {
    console.log(`[achievement] earned ${a.id}: ${a.label}`);
    if (Notification.isSupported()) {
      new Notification({
        title: `Achievement: ${a.label}`,
        body: a.description,
        silent: false,
      }).show();
    }
  });

  app.on('before-quit', () => {
    if (trayTimer) clearInterval(trayTimer);
    clearInterval(driftPoll);
  });
}

app.on('before-quit', () => {
  closeDb();
});

bootstrap().catch((err) => {
  console.error('[codeling] bootstrap failed', err);
  app.quit();
});
