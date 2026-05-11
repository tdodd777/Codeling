import type { Server as HttpServer } from 'node:http';
import * as grpc from '@grpc/grpc-js';
import { getDb } from '../db/client';
import { startGrpcReceiver } from './grpc-receiver';
import { startHttpReceiver } from './http-receiver';

// Telemetry receiver lifecycle. The HTTP + gRPC OTLP servers run as a pair —
// either both up or both down. State persists in the meta table so the choice
// survives restarts. Default is ON for back-compat with pre-toggle saves.
//
// Stopping is graceful: HTTP server.close() drains in-flight requests; gRPC
// tryShutdown waits for active calls. Both have a 1s force-close timer in
// case a connection wedges — local OTLP traffic is small and short-lived so
// this rarely triggers in practice.

const META_KEY = 'telemetry_enabled';

let httpServer: HttpServer | null = null;
let grpcServer: grpc.Server | null = null;
let starting = false;
let stopping = false;

export function getTelemetryEnabled(): boolean {
  const row = getDb()
    .prepare<[string], { value: string }>(`SELECT value FROM meta WHERE key = ?`)
    .get(META_KEY);
  if (!row) return true; // default ON for first-launch + back-compat
  return row.value === '1';
}

function persistTelemetryEnabled(enabled: boolean): void {
  getDb()
    .prepare<[string, string]>(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`)
    .run(META_KEY, enabled ? '1' : '0');
}

export function isReceiversRunning(): boolean {
  return !!httpServer || !!grpcServer;
}

// Idempotent. If receivers are already up (or in the middle of starting),
// returns without doing anything. Failure to start either receiver leaves
// the system in a partial state — caller logs; the user can retry via the
// toggle. Doesn't throw.
export async function startReceivers(): Promise<void> {
  if (isReceiversRunning() || starting) return;
  starting = true;
  try {
    httpServer = await startHttpReceiver();
  } catch (err) {
    console.error('[otel:http] failed to start', err);
  }
  try {
    grpcServer = await startGrpcReceiver();
  } catch (err) {
    console.error('[otel:grpc] failed to start', err);
  }
  starting = false;
}

export async function stopReceivers(): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (httpServer) {
    const server = httpServer;
    httpServer = null;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      server.close(() => finish());
      // Backstop: if a sticky connection holds close() open, give up after 1s.
      // Unref so the timer doesn't keep the process alive on app quit.
      const t = setTimeout(finish, 1000);
      if (typeof t.unref === 'function') t.unref();
    });
    console.log('[otel:http] stopped');
  }
  if (grpcServer) {
    const server = grpcServer;
    grpcServer = null;
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      server.tryShutdown(() => finish());
      const t = setTimeout(() => {
        try {
          server.forceShutdown();
        } catch {
          /* ignore — likely already shut down */
        }
        finish();
      }, 1000);
      if (typeof t.unref === 'function') t.unref();
    });
    console.log('[otel:grpc] stopped');
  }
  stopping = false;
}

// Toggle from the Settings UI. Persists first so a crash mid-toggle leaves
// the meta in the intended state; then start or stop receivers to match.
export async function setTelemetryEnabled(enabled: boolean): Promise<boolean> {
  persistTelemetryEnabled(enabled);
  if (enabled) {
    await startReceivers();
  } else {
    await stopReceivers();
  }
  return isReceiversRunning();
}
