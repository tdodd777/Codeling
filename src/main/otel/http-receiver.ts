import express from 'express';
import type { Server } from 'node:http';
import { handleStopHook, type StopHookEvent } from '../stop-hook';
import { getOtlpDecoders } from './decoders';
import { ingest } from './ingest';

const PORT = 4318;
const HOST = '127.0.0.1';

export async function startHttpReceiver(): Promise<Server> {
  const decoders = await getOtlpDecoders();
  const app = express();

  // OTLP/HTTP uses application/x-protobuf for protobuf and application/json for JSON.
  app.use(express.raw({ type: 'application/x-protobuf', limit: '10mb' }));
  app.use(express.json({ type: 'application/json', limit: '10mb' }));

  app.post('/v1/traces', (req, res) => {
    try {
      const payload = Buffer.isBuffer(req.body)
        ? decoders.decodeTraces(req.body)
        : req.body;
      ingest('trace', 'http', payload);
      res.set('Content-Type', 'application/x-protobuf').status(200).send(Buffer.alloc(0));
    } catch (err) {
      console.error('[otel:http] trace decode failed', err);
      res.status(400).end();
    }
  });

  app.post('/v1/metrics', (req, res) => {
    try {
      const payload = Buffer.isBuffer(req.body)
        ? decoders.decodeMetrics(req.body)
        : req.body;
      ingest('metric', 'http', payload);
      res.set('Content-Type', 'application/x-protobuf').status(200).send(Buffer.alloc(0));
    } catch (err) {
      console.error('[otel:http] metric decode failed', err);
      res.status(400).end();
    }
  });

  app.post('/v1/logs', (req, res) => {
    try {
      const payload = Buffer.isBuffer(req.body)
        ? decoders.decodeLogs(req.body)
        : req.body;
      ingest('log', 'http', payload);
      res.set('Content-Type', 'application/x-protobuf').status(200).send(Buffer.alloc(0));
    } catch (err) {
      console.error('[otel:http] log decode failed', err);
      res.status(400).end();
    }
  });

  // Codeling-specific endpoint, not OTLP. The Claude Code Stop hook posts a
  // JSON event with session_id (and other fields we ignore). Used as a
  // supplementary tally — see src/main/stop-hook.ts for algorithm.
  app.post('/codeling/stop-hook', (req, res) => {
    try {
      const body: StopHookEvent =
        typeof req.body === 'object' && req.body !== null ? req.body : {};
      const result = handleStopHook(body);
      if ('error' in result) {
        res.status(400).json(result);
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error('[stop-hook] failed', err);
      res.status(500).end();
    }
  });

  return new Promise<Server>((resolve, reject) => {
    const server = app.listen(PORT, HOST, () => {
      console.log(`[otel:http] listening on http://${HOST}:${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}
