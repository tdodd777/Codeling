import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'node:path';
import { protoIncludeDir } from './decoders';
import { ingest } from './ingest';

const PORT = 4317;
const HOST = '127.0.0.1';

const SERVICE_PROTOS = [
  'opentelemetry/proto/collector/trace/v1/trace_service.proto',
  'opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
  'opentelemetry/proto/collector/logs/v1/logs_service.proto',
];

export async function startGrpcReceiver(): Promise<grpc.Server> {
  const includeDir = protoIncludeDir();

  const packageDef = protoLoader.loadSync(
    SERVICE_PROTOS.map((rel) => path.join(includeDir, rel)),
    {
      keepCase: true,
      longs: Number,
      enums: String,
      bytes: String,
      defaults: false,
      oneofs: true,
      includeDirs: [includeDir],
    },
  );

  const loaded = grpc.loadPackageDefinition(packageDef) as unknown as {
    opentelemetry: {
      proto: {
        collector: {
          trace: { v1: { TraceService: { service: grpc.ServiceDefinition } } };
          metrics: { v1: { MetricsService: { service: grpc.ServiceDefinition } } };
          logs: { v1: { LogsService: { service: grpc.ServiceDefinition } } };
        };
      };
    };
  };

  const server = new grpc.Server();

  server.addService(loaded.opentelemetry.proto.collector.trace.v1.TraceService.service, {
    Export: (call: grpc.ServerUnaryCall<unknown, unknown>, cb: grpc.sendUnaryData<unknown>) => {
      try {
        ingest('trace', 'grpc', call.request);
        cb(null, { partialSuccess: {} });
      } catch (err) {
        cb(err as Error);
      }
    },
  });

  server.addService(loaded.opentelemetry.proto.collector.metrics.v1.MetricsService.service, {
    Export: (call: grpc.ServerUnaryCall<unknown, unknown>, cb: grpc.sendUnaryData<unknown>) => {
      try {
        ingest('metric', 'grpc', call.request);
        cb(null, { partialSuccess: {} });
      } catch (err) {
        cb(err as Error);
      }
    },
  });

  server.addService(loaded.opentelemetry.proto.collector.logs.v1.LogsService.service, {
    Export: (call: grpc.ServerUnaryCall<unknown, unknown>, cb: grpc.sendUnaryData<unknown>) => {
      try {
        ingest('log', 'grpc', call.request);
        cb(null, { partialSuccess: {} });
      } catch (err) {
        cb(err as Error);
      }
    },
  });

  return new Promise<grpc.Server>((resolve, reject) => {
    server.bindAsync(
      `${HOST}:${PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) return reject(err);
        console.log(`[otel:grpc] listening on ${HOST}:${boundPort}`);
        resolve(server);
      },
    );
  });
}
