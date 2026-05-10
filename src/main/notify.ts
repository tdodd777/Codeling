import { BrowserWindow } from 'electron';

let scheduled = false;
const CHANNEL = 'codeling:update';

// Coalesce bursts: OTLP arrives in batches of multiple signals back-to-back, so
// we collapse all notifications inside a single tick into one renderer refresh.
export function notifyUpdate(): void {
  if (scheduled) return;
  scheduled = true;
  setImmediate(() => {
    scheduled = false;
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(CHANNEL);
    }
  });
}
