/**
 * What one call from node_api did inside this service, for OnSell staff
 * leaving feedback (feedback plan, r3-svc-trace).
 *
 * node_api opens a trace for a staff request and stamps `traceparent`, sampled,
 * on the calls it makes to us. For those calls only, this module records:
 *
 * - a server span for the handler, named by its route template;
 * - a client span for every outbound axios call (Trendyol, eMAG, …);
 * - the console lines the handler wrote.
 *
 * The spans go back in the `X-Onsell-Spans` response header, at most 3 KB of
 * JSON, which node_api adopts into its own trace. The whole record — every
 * span and log line — waits ten minutes in memory for node_api to fetch with
 * `GET /internal/trace/:traceId` when it seals its trace.
 *
 * The rules this file keeps:
 *
 * - Nothing here may fail a call. Every hook is wrapped; a broken span is a
 *   missing span.
 * - No `traceparent` leaves this service. A marketplace never receives our
 *   trace id.
 * - No header is recorded, request or response. URLs keep their path and
 *   query keys only, and every string goes through `scrubText`
 *   (`feedback-redact.ts`, a byte-for-byte copy of node_api's).
 * - A request without a sampled `traceparent` — every cron, every merchant
 *   call — opens nothing and pays one `getStore()` per console line.
 *
 * Shared byte-for-byte between trendyol and emag; the service name is the one
 * thing passed in.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import { performance } from 'perf_hooks';
import { format } from 'util';
import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { redactUrl, scrubText } from './feedback-redact';

export const SPAN_HEADER = 'X-Onsell-Spans';
export const HEADER_MAX_BYTES = 3 * 1024;
export const RECORD_TTL_MS = 10 * 60 * 1000;
export const STORE_MAX_BYTES = 20 * 1024 * 1024;

const MAX_SPANS = 50;
const MAX_LOGS = 200;
const MAX_LOG_CHARS = 1000;
const MAX_ERROR_CHARS = 500;

export type SpanKind = 'server' | 'client' | 'internal';
export type SpanStatus = 'ok' | 'error' | 'unset';
export type SpanAttrs = Record<string, string | number | boolean>;

/** node_api's `Span` (`feedbackTrace/traceContext.ts`), field for field. */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  service: string;
  handler: string | null;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  /** Unix epoch nanoseconds, as a string: JSON numbers lose the last digits. */
  startNs: string;
  durMs: number | null;
  attrs: SpanAttrs;
  events: { name: string; atMs: number; attrs?: SpanAttrs }[];
}

export interface TraceLog {
  /** Milliseconds after this service's server span started. */
  atMs: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

/** One call node_api made to this service within the trace. */
export interface CallRecord {
  service: string;
  server: Span;
  spans: Span[];
  logs: TraceLog[];
  overflow: { spans: number; logs: number };
  /** Writes after the response was sent. */
  lateDropped: number;
}

/** What `GET /internal/trace/:traceId` answers: every call of that trace. */
export interface TraceRecordJson {
  traceId: string;
  service: string;
  calls: CallRecord[];
}

interface Context {
  traceId: string;
  record: CallRecord;
  startMs: number;
  closed: boolean;
}

const storage = new AsyncLocalStorage<Context>();

// ── Ids and time ────────────────────────────────────────────────────────────

const TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceParent {
  traceId: string;
  parentId: string;
  sampled: boolean;
}

/** W3C trace-context, strictly: a malformed header is no header. */
export function parseTraceparent(value: unknown): TraceParent | null {
  if (typeof value !== 'string') return null;
  const match = TRACEPARENT.exec(value.trim().toLowerCase());
  if (!match) return null;
  const [, version, traceId, parentId, flags] = match;
  if (version === 'ff' || /^0+$/.test(traceId) || /^0+$/.test(parentId)) return null;
  return { traceId, parentId, sampled: (parseInt(flags, 16) & 1) === 1 };
}

const TRACE_ID = /^[0-9a-f]{32}$/;

export function isTraceId(value: unknown): value is string {
  return typeof value === 'string' && TRACE_ID.test(value);
}

function newSpanId(): string {
  return randomBytes(8).toString('hex');
}

/** Fractional epoch milliseconds, monotonic within the process. */
function nowMs(): number {
  return performance.timeOrigin + performance.now();
}

/** Epoch nanoseconds as a string, built without bigint (the build targets ES2016). */
function toNs(epochMs: number): string {
  const whole = Math.floor(epochMs);
  const sub = Math.floor((epochMs - whole) * 1e6);
  return `${whole}${String(sub).padStart(6, '0')}`;
}

function round(ms: number): number {
  return Math.round(ms * 100) / 100;
}

export function currentTraceId(): string | undefined {
  return storage.getStore()?.traceId;
}

// ── The store ───────────────────────────────────────────────────────────────

interface Stored {
  calls: CallRecord[];
  bytes: number;
  expiresAt: number;
}

/** Insertion-ordered, so the first key is always the oldest. */
const store = new Map<string, Stored>();
let storeBytes = 0;

function evict(now: number): void {
  for (const [id, entry] of store) {
    if (entry.expiresAt > now && storeBytes <= STORE_MAX_BYTES) break;
    store.delete(id);
    storeBytes -= entry.bytes;
  }
}

function keep(traceId: string, call: CallRecord): void {
  const bytes = Buffer.byteLength(JSON.stringify(call));
  if (bytes > STORE_MAX_BYTES) return;
  const now = Date.now();
  const existing = store.get(traceId);
  const calls = existing ? [...existing.calls, call] : [call];
  if (existing) {
    store.delete(traceId);
    storeBytes -= existing.bytes;
  }
  const total = (existing?.bytes ?? 0) + bytes;
  store.set(traceId, { calls, bytes: total, expiresAt: now + RECORD_TTL_MS });
  storeBytes += total;
  evict(now);
}

export function loadRecord(traceId: string, service: string): TraceRecordJson | null {
  evict(Date.now());
  const entry = store.get(traceId);
  return entry ? { traceId, service, calls: entry.calls } : null;
}

/** Test seam. */
export function storeStats() {
  return { traces: store.size, bytes: storeBytes };
}

/** Test seam. */
export function clearStore(): void {
  store.clear();
  storeBytes = 0;
}

// ── Recording ───────────────────────────────────────────────────────────────

function writable(ctx: Context): boolean {
  if (ctx.closed) {
    ctx.record.lateDropped += 1;
    return false;
  }
  return true;
}

function pushSpan(ctx: Context, span: Span): void {
  if (!writable(ctx)) return;
  if (ctx.record.spans.length >= MAX_SPANS) {
    ctx.record.overflow.spans += 1;
    return;
  }
  ctx.record.spans.push(span);
}

// ── Console ─────────────────────────────────────────────────────────────────

const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const;
let consoleInstalled = false;

/**
 * An axios error or response, inspected, prints `config.headers` — the
 * seller's credentials, in a header `scrubText` has no pattern for. What the
 * captured line keeps of one is the call and its outcome.
 */
function loggable(arg: unknown): unknown {
  const value = arg as { isAxiosError?: boolean; config?: InternalAxiosRequestConfig; status?: number; message?: string; response?: { status?: number } };
  if (!value || typeof value !== 'object' || !value.config || typeof value.config !== 'object') return arg;
  const method = (value.config.method ?? 'get').toUpperCase();
  let url = '';
  try {
    url = redactUrl(fullUrl(value.config));
  } catch {
    url = '(url)';
  }
  const status = value.response?.status ?? value.status;
  const outcome = value.isAxiosError ? `${value.message ?? 'error'}` : 'response';
  return `[axios ${method} ${url}${status !== undefined ? ` → ${status}` : ''}] ${outcome}`;
}

function installConsoleCapture(): void {
  if (consoleInstalled) return;
  consoleInstalled = true;

  for (const level of LEVELS) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        const ctx = storage.getStore();
        if (ctx && writable(ctx)) {
          if (ctx.record.logs.length >= MAX_LOGS) {
            ctx.record.overflow.logs += 1;
          } else {
            const text = format(...args.map(loggable));
            ctx.record.logs.push({
              atMs: Math.round(nowMs() - ctx.startMs),
              level,
              message: scrubText(text.length > MAX_LOG_CHARS ? `${text.slice(0, MAX_LOG_CHARS)}…` : text),
            });
          }
        }
      } catch {
        // Tracing never costs the log line it was copying.
      }
      // stdout gets the same reduction: an axios object printed whole carries
      // config.headers, and container logs are read by people and agents.
      original(...args.map(loggable));
    };
  }
}

// ── Outbound ────────────────────────────────────────────────────────────────

const STARTED = Symbol('feedbackTraceStarted');

type Traced = InternalAxiosRequestConfig & { [STARTED]?: { ctx: Context; at: number } };

/** With `params` serialised in, so their keys show and their values are redacted like any query. */
function fullUrl(config: InternalAxiosRequestConfig): string {
  try {
    return axios.getUri(config);
  } catch {
    // Fall through to the base + path join.
  }
  const url = config.url ?? '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || !config.baseURL) return url;
  return `${config.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function onRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  try {
    const ctx = storage.getStore();
    if (ctx && !ctx.closed) (config as Traced)[STARTED] = { ctx, at: nowMs() };
  } catch {
    // Never the reason a call did not go out.
  }
  return config;
}

function finishSpan(config: InternalAxiosRequestConfig | undefined, response: AxiosResponse | undefined, error?: AxiosError) {
  const started = config ? (config as Traced)[STARTED] : undefined;
  if (!config || !started) return;
  const { ctx, at } = started;
  const url = fullUrl(config);
  const method = (config.method ?? 'get').toUpperCase();
  const host = hostOf(url);
  const status = response?.status;
  const attrs: SpanAttrs = {
    'http.method': method,
    'http.url': redactUrl(url),
    'net.peer.name': host,
  };
  if (status !== undefined) attrs['http.status_code'] = status;
  if (error) {
    const message = scrubText(error.message || 'error');
    attrs['error.message'] = message.length > MAX_ERROR_CHARS ? `${message.slice(0, MAX_ERROR_CHARS)}…` : message;
    if (error.code) attrs['error.code'] = error.code;
  }
  const failed = !!error || (status !== undefined && status >= 500);
  pushSpan(ctx, {
    traceId: ctx.traceId,
    spanId: newSpanId(),
    parentSpanId: ctx.record.server.spanId,
    service: ctx.record.service,
    handler: null,
    name: `${method} ${host}`,
    kind: 'client',
    status: failed ? 'error' : 'ok',
    startNs: toNs(at),
    durMs: round(nowMs() - at),
    attrs,
    events: [],
  });
}

function attach(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use(onRequest);
  instance.interceptors.response.use(
    (response) => {
      try {
        finishSpan(response.config, response);
      } catch {
        // The response is what matters.
      }
      return response;
    },
    (error: unknown) => {
      try {
        if (axios.isAxiosError(error)) finishSpan(error.config, error.response, error);
      } catch {
        // The original error is what the caller must see.
      }
      return Promise.reject(error);
    }
  );
  return instance;
}

let installed = false;

/**
 * Called once, from the entry point right after `demoGuard`, before any
 * module builds a client: the default instance and every `axios.create`.
 */
export function installFeedbackTrace(): void {
  if (installed) return;
  installed = true;

  installConsoleCapture();

  const create = axios.create.bind(axios);
  axios.create = ((config?: Parameters<typeof create>[0]) => attach(create(config))) as typeof axios.create;
  attach(axios as unknown as AxiosInstance);
}

/** Test seam. */
export function attachFeedbackTrace(instance: AxiosInstance): AxiosInstance {
  return attach(instance);
}

// ── The span header ─────────────────────────────────────────────────────────

/** Header values are latin-1; JSON escapes keep diacritics in an error message legal. */
function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * `{ spans }` in at most `HEADER_MAX_BYTES`, the server span first. Cut in
 * order: client attributes, then client spans from the end. `truncated` tells
 * node_api the full record is worth fetching.
 */
export function encodeSpanHeader(server: Span, spans: Span[]): string {
  const fits = (text: string) => Buffer.byteLength(text) <= HEADER_MAX_BYTES;

  let text = asciiJson({ spans: [server, ...spans] });
  if (fits(text)) return text;

  const bare = spans.map((span) => ({ ...span, attrs: {}, events: [] }));
  for (let n = bare.length; n >= 0; n--) {
    text = asciiJson({ spans: [server, ...bare.slice(0, n)], truncated: true });
    if (fits(text)) return text;
  }
  return asciiJson({ spans: [{ ...server, attrs: {}, events: [] }], truncated: true });
}

// ── Middleware ──────────────────────────────────────────────────────────────

function handlerOf(req: Request, res: Response): string | null {
  const route = (req as Request & { route?: { path?: unknown } }).route;
  if (!route || typeof route.path !== 'string') return null;
  const mount = typeof res.locals?.mountPath === 'string' ? res.locals.mountPath : req.baseUrl;
  return `${req.method} ${mount}${route.path}`;
}

function sealServer(ctx: Context, req: Request, res: Response, files: Record<string, string>): void {
  const server = ctx.record.server;
  const handler = handlerOf(req, res);
  const mount = typeof res.locals?.mountPath === 'string' ? res.locals.mountPath : req.baseUrl;
  server.handler = handler;
  server.name = handler ?? `${req.method} (no route)`;
  server.status = res.statusCode >= 500 ? 'error' : 'ok';
  server.durMs = round(nowMs() - ctx.startMs);
  server.attrs['http.status_code'] = res.statusCode;
  const file = mount ? files[mount] : undefined;
  if (file && handler) server.attrs['code.filepath'] = file;
}

/**
 * Mounted after `requireInternalApiKey`, so only node_api can open a context.
 *
 * `files` maps each mount path to its router file (`/api/orders` →
 * `api/routes/orders.ts`): the handler manifest, which puts the file an
 * engineer opens beside the route template on every server span.
 */
export function feedbackTraceMiddleware(service: string, files: Record<string, string> = {}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    let ctx: Context | null = null;
    try {
      const parent = parseTraceparent(req.headers.traceparent);
      if (parent?.sampled) {
        const startMs = nowMs();
        ctx = {
          traceId: parent.traceId,
          startMs,
          closed: false,
          record: {
            service,
            server: {
              traceId: parent.traceId,
              spanId: newSpanId(),
              parentSpanId: parent.parentId,
              service,
              handler: null,
              name: `${req.method} (no route)`,
              kind: 'server',
              status: 'unset',
              startNs: toNs(startMs),
              durMs: null,
              attrs: {
                'http.method': req.method,
                'http.target': redactUrl(req.originalUrl || req.url),
              },
              events: [],
            },
            spans: [],
            logs: [],
            overflow: { spans: 0, logs: 0 },
            lateDropped: 0,
          },
        };
      }
    } catch {
      ctx = null;
    }
    if (!ctx) {
      next();
      return;
    }
    const open = ctx;

    const writeHead = res.writeHead;
    res.writeHead = function patched(this: Response, ...args: unknown[]) {
      try {
        sealServer(open, req, res, files);
        res.setHeader(SPAN_HEADER, encodeSpanHeader(open.record.server, open.record.spans));
      } catch {
        // The response goes out without the header; node_api still fetches the record.
      }
      return (writeHead as (...a: unknown[]) => Response).apply(this, args);
    } as typeof res.writeHead;

    res.on('finish', () => {
      try {
        sealServer(open, req, res, files);
        open.closed = true;
        keep(open.traceId, open.record);
      } catch {
        // A record not kept is a `partial` on node_api's side, never a failed call.
      }
    });

    storage.run(open, () => next());
  };
}

/**
 * `GET /internal/trace/:traceId`, behind the internal key. 404 when the record
 * expired, was evicted, or never existed — node_api records that as partial.
 */
export function traceRecordHandler(service: string): RequestHandler {
  return (req: Request, res: Response): void => {
    res.setHeader('Cache-Control', 'no-store');
    const traceId = String(req.params.traceId ?? '').toLowerCase();
    if (!isTraceId(traceId)) {
      res.status(400).json({ success: false, error: 'traceId must be 32 hex characters' });
      return;
    }
    const record = loadRecord(traceId, service);
    if (!record) {
      res.status(404).json({ success: false, error: 'No record for this trace' });
      return;
    }
    res.json(record);
  };
}

/** `GET /internal/trace/handlers`: every route template and the file it lives in. */
export function handlerManifest(app: unknown, files: Record<string, string>) {
  const out: { handler: string; file: string | null }[] = [];
  const stack = (app as { _router?: { stack?: unknown[] } })._router?.stack ?? [];
  for (const layer of stack as { name?: string; regexp?: RegExp; handle?: { stack?: unknown[] } }[]) {
    if (layer.name !== 'router' || !layer.handle?.stack) continue;
    const mount = Object.keys(files).find((path) => layer.regexp?.test(path));
    if (!mount) continue;
    for (const sub of layer.handle.stack as { route?: { path?: string; methods?: Record<string, boolean> } }[]) {
      if (!sub.route?.path) continue;
      for (const method of Object.keys(sub.route.methods ?? {})) {
        out.push({ handler: `${method.toUpperCase()} ${mount}${sub.route.path}`, file: files[mount] ?? null });
      }
    }
  }
  return out;
}

installFeedbackTrace();
