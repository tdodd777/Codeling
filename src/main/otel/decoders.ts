import { app } from 'electron';
import path from 'node:path';
import protobuf from 'protobufjs';

let cachedRoot: protobuf.Root | null = null;

function protoBaseDir(): string {
  // extraResource in forge.config.ts copies ./proto into the packaged resources dir.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'proto')
    : path.join(app.getAppPath(), 'proto');
}

export async function loadOtlpRoot(): Promise<protobuf.Root> {
  if (cachedRoot) return cachedRoot;

  const base = protoBaseDir();
  const root = new protobuf.Root();

  root.resolvePath = (_origin, target) => {
    if (path.isAbsolute(target)) return target;
    if (target.startsWith('opentelemetry/')) return path.join(base, target);
    return target;
  };

  await root.load(
    [
      'opentelemetry/proto/collector/trace/v1/trace_service.proto',
      'opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
      'opentelemetry/proto/collector/logs/v1/logs_service.proto',
    ].map((rel) => path.join(base, rel)),
    { keepCase: true },
  );

  cachedRoot = root;
  return root;
}

export interface OtlpDecoders {
  decodeTraces(buf: Uint8Array): unknown;
  decodeMetrics(buf: Uint8Array): unknown;
  decodeLogs(buf: Uint8Array): unknown;
}

export async function getOtlpDecoders(): Promise<OtlpDecoders> {
  const root = await loadOtlpRoot();
  const TraceReq = root.lookupType(
    'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest',
  );
  const MetricsReq = root.lookupType(
    'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
  );
  const LogsReq = root.lookupType(
    'opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest',
  );

  const opts: protobuf.IConversionOptions = {
    longs: Number,
    enums: String,
    bytes: String,
    defaults: false,
  };

  return {
    decodeTraces: (buf) => TraceReq.toObject(TraceReq.decode(buf), opts),
    decodeMetrics: (buf) => MetricsReq.toObject(MetricsReq.decode(buf), opts),
    decodeLogs: (buf) => LogsReq.toObject(LogsReq.decode(buf), opts),
  };
}

export function protoIncludeDir(): string {
  return protoBaseDir();
}
