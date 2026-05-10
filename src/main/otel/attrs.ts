// Helpers for walking OTLP payloads decoded with `keepCase: true`.
// Both protobufjs (HTTP path) and @grpc/proto-loader (gRPC path) emit snake_case
// keys when configured that way, so the helpers below assume snake_case but fall
// back to camelCase to stay defensive against future loader/option changes.

export function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

interface OtlpAttr {
  key: string;
  value: Record<string, unknown>;
}

export function attrValue(v: Record<string, unknown> | undefined): string | number | boolean | undefined {
  if (!v) return undefined;
  const sv = pick<string>(v, 'string_value', 'stringValue');
  if (sv !== undefined) return sv;
  const iv = pick<number | string>(v, 'int_value', 'intValue');
  if (iv !== undefined) return Number(iv);
  const dv = pick<number>(v, 'double_value', 'doubleValue');
  if (dv !== undefined) return dv;
  const bv = pick<boolean>(v, 'bool_value', 'boolValue');
  if (bv !== undefined) return bv;
  return undefined;
}

export function getAttr(
  attrs: unknown,
  key: string,
): string | number | boolean | undefined {
  if (!Array.isArray(attrs)) return undefined;
  for (const a of attrs as OtlpAttr[]) {
    if (a?.key === key) return attrValue(a.value);
  }
  return undefined;
}

export function dataPointValue(dp: Record<string, unknown>): number {
  const i = pick<number | string>(dp, 'as_int', 'asInt');
  if (i !== undefined) return Number(i);
  const d = pick<number>(dp, 'as_double', 'asDouble');
  if (d !== undefined) return d;
  return 0;
}

export function nanosToMs(nanos: unknown): number {
  if (nanos == null) return Date.now();
  const n = Number(nanos);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return Math.round(n / 1_000_000);
}
