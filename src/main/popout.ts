import { BrowserWindow } from 'electron';
import type { Menubar } from 'menubar';
import { getDb } from './db/client';
import { notifyUpdate } from './notify';

// Standalone popout window. Loads the same renderer URL as the menubar panel
// — the tabs / IPC / state subscriptions all "just work" because both windows
// share the renderer codebase + the codeling:update broadcast channel.
//
// Design choice (per DIRECTION.md 2026-05-10): only one surface visible at a
// time. When the popout is open we hide the menubar panel and suppress any
// attempt to show it (clicking the tray icon focuses the popout instead).
// Closing the popout returns to normal menubar behavior.

interface PopoutDeps {
  mb: Menubar;
  rendererUrl: string;
  preloadPath: string;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BOUNDS_META_KEY = 'popout:bounds';
const DEFAULT_BOUNDS: Bounds = { x: 100, y: 100, width: 480, height: 720 };

let deps: PopoutDeps | null = null;
let popout: BrowserWindow | null = null;

export function initPopout(d: PopoutDeps): void {
  deps = d;
  // Replace menubar's internal tray click handler. We intercept the click
  // *before* it shows the menubar window so there's no flicker when the
  // popout is the active surface; in that case we focus the popout instead.
  // When the popout is closed, fall back to the menubar's default toggle
  // behavior (show if hidden, hide if visible).
  const tray = d.mb.tray;
  if (tray) {
    tray.removeAllListeners('click');
    tray.on('click', () => {
      if (isPopoutOpen() && popout && !popout.isDestroyed()) {
        if (popout.isMinimized()) popout.restore();
        popout.show();
        popout.focus();
        return;
      }
      if (d.mb.window?.isVisible()) {
        d.mb.hideWindow();
      } else {
        d.mb.showWindow();
      }
    });
  }
  // Safety net for code paths that show the menubar window without going
  // through tray-click (e.g., programmatic mb.showWindow). Closes the flicker
  // gap if any such path slips in.
  d.mb.on('after-show', () => {
    if (!isPopoutOpen()) return;
    d.mb.hideWindow();
    if (popout && !popout.isDestroyed()) {
      popout.show();
      popout.focus();
    }
  });
}

export function isPopoutOpen(): boolean {
  return !!popout && !popout.isDestroyed();
}

// Opens the popout if it doesn't exist; focuses + restores it if it does.
// Hides the menubar panel either way so the player always lands on the
// single active surface.
export function openPopout(): { ok: true } | { error: 'not-initialized' } {
  if (!deps) return { error: 'not-initialized' };
  deps.mb.hideWindow();

  if (popout && !popout.isDestroyed()) {
    if (popout.isMinimized()) popout.restore();
    popout.show();
    popout.focus();
    notifyUpdate();
    return { ok: true };
  }

  const bounds = loadBounds();
  popout = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 380,
    minHeight: 480,
    title: 'Codeling',
    autoHideMenuBar: true,
    webPreferences: {
      preload: deps.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  popout.loadURL(deps.rendererUrl);

  // Persist on close so next open restores the chosen size/position. Doing it
  // on `close` instead of `move`/`resize` avoids meta-table chatter while the
  // user is dragging the window around.
  popout.on('close', () => {
    if (popout && !popout.isDestroyed()) saveBounds(popout.getBounds());
  });
  popout.on('closed', () => {
    popout = null;
    notifyUpdate();
  });

  notifyUpdate();
  return { ok: true };
}

// Programmatic close — used by the in-app button. The popout's `closed`
// listener clears the module ref. If the popout has window controls of its
// own (it does — autoHideMenuBar leaves the default close button), the same
// event path runs.
export function closePopout(): void {
  if (popout && !popout.isDestroyed()) popout.close();
}

function loadBounds(): Bounds {
  const row = getDb()
    .prepare<[string], { value: string }>(`SELECT value FROM meta WHERE key = ?`)
    .get(BOUNDS_META_KEY);
  if (!row) return DEFAULT_BOUNDS;
  try {
    const parsed = JSON.parse(row.value) as Partial<Bounds>;
    // Soft validation — fall back to defaults for any malformed field rather
    // than throwing or rendering an offscreen window.
    return {
      x: Number.isFinite(parsed.x) ? parsed.x! : DEFAULT_BOUNDS.x,
      y: Number.isFinite(parsed.y) ? parsed.y! : DEFAULT_BOUNDS.y,
      width: Number.isFinite(parsed.width) && parsed.width! >= 380 ? parsed.width! : DEFAULT_BOUNDS.width,
      height: Number.isFinite(parsed.height) && parsed.height! >= 480 ? parsed.height! : DEFAULT_BOUNDS.height,
    };
  } catch {
    return DEFAULT_BOUNDS;
  }
}

function saveBounds(b: Bounds): void {
  getDb()
    .prepare<[string, string]>(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`)
    .run(BOUNDS_META_KEY, JSON.stringify(b));
}
