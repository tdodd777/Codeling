import { app, nativeImage, type NativeImage } from 'electron';
import { menubar } from 'menubar';
import path from 'node:path';
import fs from 'node:fs';
import type { Species } from '@shared/types';
import { getDb, closeDb } from './db/client';
import { getPet } from './db/repos';
import { registerIpcHandlers } from './ipc';
import { startHttpReceiver } from './otel/http-receiver';
import { startGrpcReceiver } from './otel/grpc-receiver';

const TRAY_TARGET_PX = 40;
const TRAY_FPS = 4;

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

function processForTray(img: NativeImage): NativeImage {
  // 1. Crop the source to its visible bounding box (PixelLab pads heavily).
  // 2. Take just the top portion — Windows tray slot is too small to read a
  //    full body, so we focus on the most distinctive bits (hat + face).
  // 3. Re-crop content in case the top portion introduced new whitespace
  //    (e.g., a peaked hat with empty shoulders below it).
  // 4. Resize so the longest dim hits TRAY_TARGET_PX, preserving aspect.
  const headOnly = cropToContent(takeTop(cropToContent(img), 0.55));
  if (process.platform !== 'win32') return headOnly;
  const { width: cw, height: ch } = headOnly.getSize();
  const ratio = TRAY_TARGET_PX / Math.max(cw, ch, 1);
  return headOnly.resize({
    width: Math.max(1, Math.round(cw * ratio)),
    height: Math.max(1, Math.round(ch * ratio)),
    quality: 'best',
  });
}

function trayIcon(): NativeImage {
  // Prefer the current pet's south rotation so the tray reflects what's in the panel.
  try {
    const pet = getPet();
    const speciesIcon = path.join(assetsRoot(), 'sprites', pet.species, 'rotations', 'south.png');
    if (fs.existsSync(speciesIcon)) {
      return processForTray(nativeImage.createFromPath(speciesIcon));
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
  const animDir = path.join(assetsRoot(), 'sprites', species, 'animations');
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
  return files.map((f) => processForTray(nativeImage.createFromPath(path.join(southDir, f))));
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
  registerIpcHandlers();

  // Start both OTLP receivers in parallel; failures shouldn't block the UI.
  startHttpReceiver().catch((err) => console.error('[otel:http] failed to start', err));
  startGrpcReceiver().catch((err) => console.error('[otel:grpc] failed to start', err));

  const mb = menubar({
    index: rendererIndex(),
    icon: trayIcon(),
    tooltip: 'Codeling',
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
  });

  mb.on('after-create-window', () => {
    if (!app.isPackaged) {
      mb.window?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  let trayTimer: NodeJS.Timeout | null = null;
  function startTrayAnimation() {
    if (trayTimer) clearInterval(trayTimer);
    let frames: NativeImage[] = [];
    try {
      frames = buildIdleTrayFrames(getPet().species);
    } catch {
      return;
    }
    if (frames.length <= 1) return; // no animation available — keep static icon
    console.log(`[tray] animating ${frames.length} idle frames at ${TRAY_FPS} fps`);
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

  app.on('before-quit', () => {
    if (trayTimer) clearInterval(trayTimer);
  });
}

app.on('before-quit', () => {
  closeDb();
});

bootstrap().catch((err) => {
  console.error('[codeling] bootstrap failed', err);
  app.quit();
});
