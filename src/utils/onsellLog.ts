/**
 * The central log contract, v1 — what a service writes to stdout so the
 * control plane can store, search and join it (docs/central-logs.md).
 *
 * Copied byte-for-byte, with `onsellFingerprint.ts` beside it, into node_api
 * and every TypeScript service. Upstream: onsell_kstock_infra_boot
 * `src/control-plane/logs/contract/`. Edit there and copy to every repo in one
 * change; each copy's test pins both digests.
 *
 * Installed once from the entry point, before anything builds an axios client:
 *
 * - every console line becomes one JSON line on the same stream:
 *   {v, ts, level, service, tenant, traceId, spanId, connectionId, route, type:"log", msg}
 * - every request gets a server span and every axios call a client span, with
 *   headers and bodies (16 KB a body on success, 64 KB on failure, `truncated`)
 * - every credential value, by name or by shape, becomes a fingerprint
 *   (`onsellFingerprint.ts`) before the line is written
 * - health-check requests write nothing
 *
 * Tenant: the request's `X-Tenant-Id`, else the `tenant` option (node_api's
 * own context), else `TENANT_ID`. A pool line with none is `tenant: null`.
 * Trace: the `traceId` option, else an `X-Request-Id` response header that is
 * already a trace id (node_api's), else the incoming `traceparent`, sampled or
 * not, else a new id. Outbound
 * calls get a `traceparent` only where `propagate(url)` says so — internal
 * targets, never a marketplace.
 *
 * Nothing here may fail a call or lose a line: every hook is wrapped, and a
 * line that cannot be encoded is written as the text it would have been.
 *
 * On when NODE_ENV=production or ONSELL_LOG_FORMAT=json; ONSELL_LOG_FORMAT=text
 * turns it off. Test runners and local development keep plain console output.
 */
import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import { format } from 'util';
import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { createKeyedFingerprinter, poolStoreKey, type Fingerprinter } from './onsellFingerprint';

export const LOG_CONTRACT_VERSION = 1;
export const BODY_CAP_OK = 16 * 1024;
export const BODY_CAP_ERROR = 64 * 1024;
export const MSG_CAP = 64 * 1024;
export const TRACE_HEADER = 'X-Onsell-Trace-Id';

export interface OnsellLogOptions {
  /** The catalog id: `node_api`, `emag`, `shopify`, … */
  service: string;
  /** The tenant this async context belongs to, when the service knows better than the request. */
  tenant?: () => string | null | undefined;
  /** An already-open trace to join (node_api's staff-sampled feedback trace). */
  traceId?: () => string | null | undefined;
  /** Whether an outbound call carries our `traceparent`. Default: never. */
  propagate?: (url: string) => boolean;
  /** Install regardless of NODE_ENV (tests). */
  force?: boolean;
}

export interface LogContext {
  traceId: string;
  spanId: string;
  parentId: string | null;
  tenant: string | null;
  connectionId: string | null;
  route: string | null;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

interface Line {
  v: number;
  ts: string;
  level: Level;
  service: string;
  type: 'log' | 'span';
  msg: string;
  tenant?: string;
  traceId?: string;
  spanId?: string;
  connectionId?: string;
  route?: string;
  span?: SpanBody;
}

export interface SpanBody {
  kind: 'server' | 'client' | 'internal';
  name: string;
  parentId: string | null;
  status: number | null;
  durationMs: number;
  req: Record<string, unknown>;
  res: Record<string, unknown>;
  error?: { message: string; code?: string };
  truncated: boolean;
}

const storage = new AsyncLocalStorage<LogContext>();
let options: OnsellLogOptions = { service: 'unknown' };
let installed = false;

export function logEnabled(): boolean {
  const fmt = process.env.ONSELL_LOG_FORMAT;
  if (fmt === 'text') return false;
  return fmt === 'json' || process.env.NODE_ENV === 'production';
}

// ── Ids ─────────────────────────────────────────────────────────────────────

const TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

function newTraceId(): string {
  return randomBytes(16).toString('hex');
}

function newSpanId(): string {
  return randomBytes(8).toString('hex');
}

function parseParent(value: unknown): { traceId: string; parentId: string } | null {
  if (typeof value !== 'string') return null;
  const m = TRACEPARENT.exec(value.trim().toLowerCase());
  if (!m || m[1] === 'ff' || /^0+$/.test(m[2]) || /^0+$/.test(m[3])) return null;
  return { traceId: m[2], parentId: m[3] };
}

function headerValue(headers: Record<string, unknown> | undefined, name: string): string | null {
  if (!headers) return null;
  const want = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() !== want) continue;
    const v = headers[k];
    const s = Array.isArray(v) ? String(v[0]) : v === undefined || v === null ? '' : String(v);
    return s && SAFE_ID.test(s) ? s : null;
  }
  return null;
}

export function currentLogContext(): LogContext | undefined {
  return storage.getStore();
}

/** Adds what the service learned after the request opened: the store, the connection, the route. */
export function annotateLog(fields: Partial<Pick<LogContext, 'tenant' | 'connectionId' | 'route'>>): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  if (fields.tenant !== undefined) ctx.tenant = fields.tenant;
  if (fields.connectionId !== undefined) ctx.connectionId = fields.connectionId;
  if (fields.route !== undefined) ctx.route = fields.route;
}

/** Runs `fn` as its own trace: a cron run, a queue message. Its lines and calls join on one id. */
export function withLogContext<T>(fields: Partial<LogContext>, fn: () => T): T {
  const parent = storage.getStore();
  const ctx: LogContext = {
    traceId: fields.traceId ?? newTraceId(),
    spanId: fields.spanId ?? newSpanId(),
    parentId: fields.parentId ?? null,
    tenant: fields.tenant !== undefined ? fields.tenant : parent ? parent.tenant : null,
    connectionId: fields.connectionId !== undefined ? fields.connectionId : null,
    route: fields.route ?? null,
  };
  return storage.run(ctx, fn);
}

// ── Tenant and key ──────────────────────────────────────────────────────────

function optionTenant(): string | null {
  try {
    const t = options.tenant ? options.tenant() : null;
    return t || null;
  } catch {
    // An unresolved tenant is a null tenant.
    return null;
  }
}

function tenantNow(ctx?: LogContext): string | null {
  if (ctx && ctx.tenant) return ctx.tenant;
  try {
    const t = options.tenant ? options.tenant() : null;
    if (t) return t;
  } catch {
    // An unresolved tenant is a null tenant.
  }
  return process.env.TENANT_ID || null;
}

let dedicatedKey: Buffer | null | undefined;
let poolBase: Buffer | null | undefined;
const storeKeys = new Map<string, Buffer>();

function hexKey(name: string): Buffer | null {
  const v = (process.env[name] || '').trim();
  return /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, 'hex') : null;
}

/** Dedicated: this droplet's key. Pool: the store's, derived per request. None: length-only fingerprints. */
function keyFor(tenant: string | null): Buffer | null {
  if (poolBase === undefined) poolBase = hexKey('LOG_FINGERPRINT_POOL_BASE');
  if (poolBase) {
    if (!tenant) return null;
    let k = storeKeys.get(tenant);
    if (!k) {
      k = poolStoreKey(poolBase, tenant);
      if (storeKeys.size > 2000) storeKeys.clear();
      storeKeys.set(tenant, k);
    }
    return k;
  }
  if (dedicatedKey === undefined) dedicatedKey = hexKey('LOG_FINGERPRINT_KEY');
  return dedicatedKey;
}

export function fingerprinterFor(tenant: string | null): Fingerprinter {
  return createKeyedFingerprinter(keyFor(tenant));
}

// ── Writing ─────────────────────────────────────────────────────────────────

const HEALTH_PATH = /^\/(api\/)?(system\/)?(healthz?|version)(\/version)?\/?(\?|$)/;
const HEALTH_LINE = /"?(GET|HEAD) \/(api\/)?(system\/)?healthz?(\/version)?([\s?"]|$)/;

const out = process.stdout.write.bind(process.stdout);
const err = process.stderr.write.bind(process.stderr);

function clip(s: string, cap: number): { text: string; cut: boolean } {
  return s.length > cap ? { text: `${s.slice(0, cap)}…`, cut: true } : { text: s, cut: false };
}

function write(line: Line): void {
  let text: string;
  try {
    text = JSON.stringify(line);
  } catch {
    text = line.msg;
  }
  (line.level === 'error' || line.level === 'warn' ? err : out)(`${text}\n`);
}

function base(level: Level, msg: string, ctx: LogContext | undefined, tenant: string | null): Line {
  const line: Line = { v: LOG_CONTRACT_VERSION, ts: new Date().toISOString(), level, service: options.service, type: 'log', msg };
  if (tenant) line.tenant = tenant;
  if (ctx) {
    line.traceId = ctx.traceId;
    line.spanId = ctx.spanId;
    if (ctx.connectionId) line.connectionId = ctx.connectionId;
    if (ctx.route) line.route = ctx.route;
  }
  return line;
}

// ── Console ─────────────────────────────────────────────────────────────────

const CONSOLE_LEVELS: { method: 'log' | 'info' | 'warn' | 'error' | 'debug'; level: Level }[] = [
  { method: 'log', level: 'info' },
  { method: 'info', level: 'info' },
  { method: 'warn', level: 'warn' },
  { method: 'error', level: 'error' },
  { method: 'debug', level: 'debug' },
];

/** An axios error or response printed whole is its config — headers included. The client span has the detail. */
function reduce(arg: unknown): unknown {
  const v = arg as { isAxiosError?: boolean; config?: InternalAxiosRequestConfig; message?: string; response?: { status?: number }; status?: number };
  if (!v || typeof v !== 'object' || !v.config || typeof v.config !== 'object') return arg;
  const method = (v.config.method || 'get').toUpperCase();
  const status = v.response ? v.response.status : v.status;
  return `[axios ${method} ${urlOf(v.config)}${status !== undefined ? ` → ${status}` : ''}] ${v.isAxiosError ? v.message || 'error' : 'response'}`;
}

function installConsole(): void {
  for (const { method, level } of CONSOLE_LEVELS) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      try {
        const msg = format(...args.map(reduce));
        if (HEALTH_LINE.test(msg)) return;
        const ctx = storage.getStore();
        const tenant = tenantNow(ctx);
        const fp = fingerprinterFor(tenant);
        write(base(level, fp.text(clip(msg, MSG_CAP).text), ctx, tenant));
      } catch {
        original(...args);
      }
    };
  }
}

// ── Bodies and headers ──────────────────────────────────────────────────────

interface Captured {
  value?: unknown;
  bytes?: number;
  truncated: boolean;
}

function isStream(v: unknown): boolean {
  return !!v && typeof v === 'object' && typeof (v as { pipe?: unknown }).pipe === 'function';
}

function textual(contentType: string): boolean {
  return contentType === '' || /json|text|xml|x-www-form-urlencoded|javascript|graphql/i.test(contentType);
}

/** A body as the span keeps it: parsed JSON when it is JSON and fits, text when it is text, a size otherwise. */
function captureBody(raw: unknown, contentType: string, cap: number, fp: Fingerprinter): Captured {
  if (raw === undefined || raw === null || raw === '') return { truncated: false };
  const plainObject = typeof raw === 'object' && !Buffer.isBuffer(raw) && !(raw instanceof ArrayBuffer) && !ArrayBuffer.isView(raw) && !Array.isArray(raw);
  if (plainObject && !isStream(raw) && Object.keys(raw as object).length === 0) {
    return { truncated: false };
  }
  if (isStream(raw)) return { value: '[stream]', truncated: false };
  let text: string;
  if (Buffer.isBuffer(raw) || raw instanceof ArrayBuffer || ArrayBuffer.isView(raw)) {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    if (!textual(contentType) || buf.indexOf(0) !== -1) return { value: `[binary ${buf.length} bytes]`, bytes: buf.length, truncated: false };
    text = buf.toString('utf8');
  } else if (typeof raw === 'string') {
    text = raw;
  } else if (typeof raw === 'object') {
    try {
      text = JSON.stringify(raw);
    } catch {
      return { value: '[unserialisable]', truncated: false };
    }
    if (text === undefined) return { truncated: false };
    if (text.length <= cap) return { value: fp.value(raw), bytes: text.length, truncated: false };
  } else {
    return { value: raw, truncated: false };
  }
  const bytes = Buffer.byteLength(text);
  if (text.length <= cap && /json/i.test(contentType)) {
    try {
      return { value: fp.value(JSON.parse(text)), bytes, truncated: false };
    } catch {
      // Not JSON after all; kept as text.
    }
  }
  const c = clip(text, cap);
  return { value: fp.text(c.text), bytes, truncated: c.cut };
}

function plainHeaders(h: unknown): Record<string, unknown> {
  if (!h || typeof h !== 'object') return {};
  const withJson = h as { toJSON?: () => unknown };
  const src = (typeof withJson.toJSON === 'function' ? withJson.toJSON() : h) as Record<string, unknown>;
  const outH: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v === undefined || v === null || typeof v === 'function') continue;
    if (typeof v === 'object' && !Array.isArray(v)) continue;
    outH[k.toLowerCase()] = v;
  }
  return outH;
}

/** Every header kept; a credential's value replaced by its fingerprint, the rest scanned for credential shapes. */
function recordHeaders(h: unknown, fp: Fingerprinter): Record<string, unknown> {
  const src = plainHeaders(h);
  const outH: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    const v = src[k];
    const one = (x: unknown) => (typeof x === 'string' ? fp.value({ [k]: x })[k] : x);
    outH[k] = Array.isArray(v) ? v.map(one) : one(typeof v === 'number' ? String(v) : v);
  }
  return outH;
}

function contentTypeOf(h: Record<string, unknown>): string {
  const v = h['content-type'];
  return typeof v === 'string' ? v : '';
}

// ── Server spans ────────────────────────────────────────────────────────────

/** The parts of express's req/res this needs, so the module does not depend on an express version. */
interface ReqLike {
  method: string;
  url: string;
  originalUrl?: string;
  baseUrl?: string;
  headers: Record<string, unknown>;
  body?: unknown;
  route?: { path?: unknown };
}

interface ResLike {
  statusCode: number;
  headersSent: boolean;
  locals?: Record<string, unknown>;
  setHeader(name: string, value: string): unknown;
  getHeader(name: string): unknown;
  getHeaders(): Record<string, unknown>;
  write: (...args: any[]) => boolean;
  end: (...args: any[]) => unknown;
  on(event: string, cb: () => void): unknown;
}

function routeOf(req: ReqLike, res: ResLike): string | null {
  const route = req.route;
  if (!route || typeof route.path !== 'string') return null;
  const mount = res.locals && typeof res.locals.mountPath === 'string' ? res.locals.mountPath : req.baseUrl || '';
  return `${req.method} ${mount}${route.path}`;
}

function levelFor(status: number | null, failed: boolean): Level {
  if (failed || (status !== null && status >= 500)) return 'error';
  if (status !== null && status >= 400) return 'warn';
  return 'info';
}

export function onsellLogMiddleware(): (req: ReqLike, res: ResLike, next: () => void) => void {
  return (req, res, next) => {
    if (!installed) return next();
    let ctx: LogContext;
    let started: number;
    const chunks: Buffer[] = [];
    let captured = 0;
    let overflow = false;
    try {
      const path = req.originalUrl || req.url || '';
      if (HEALTH_PATH.test(path)) return next();
      const parent = parseParent(req.headers.traceparent);
      let joined: string | null | undefined = null;
      try {
        joined = options.traceId ? options.traceId() : null;
      } catch {
        joined = null;
      }
      const requestId = res.getHeader('x-request-id');
      const adopted = typeof requestId === 'string' && /^[0-9a-f]{32}$/.test(requestId) ? requestId : null;
      ctx = {
        traceId: joined || adopted || (parent ? parent.traceId : newTraceId()),
        spanId: newSpanId(),
        parentId: parent ? parent.parentId : null,
        // Read now: `finish` is a socket callback, outside the service's own context.
        tenant: headerValue(req.headers, 'x-tenant-id') || optionTenant(),
        connectionId: headerValue(req.headers, 'x-connection-id'),
        route: null,
      };
      started = Date.now();
      if (!res.headersSent) res.setHeader(TRACE_HEADER, ctx.traceId);

      const keep = (chunk: unknown, encoding?: unknown) => {
        if (overflow || chunk === undefined || chunk === null || typeof chunk === 'function') return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8');
        if (captured + buf.length > BODY_CAP_ERROR + 1) {
          chunks.push(buf.slice(0, Math.max(0, BODY_CAP_ERROR + 1 - captured)));
          overflow = true;
          captured = BODY_CAP_ERROR + 1;
          return;
        }
        chunks.push(buf);
        captured += buf.length;
      };
      const write0 = res.write;
      const end0 = res.end;
      res.write = function (this: unknown, ...args: any[]) {
        try {
          keep(args[0], args[1]);
        } catch {
          // The response is what matters.
        }
        return write0.apply(this, args);
      };
      res.end = function (this: unknown, ...args: any[]) {
        try {
          keep(args[0], args[1]);
        } catch {
          // The response is what matters.
        }
        return end0.apply(this, args);
      };

      let sealed = false;
      const seal = (aborted: boolean) => {
        if (sealed) return;
        sealed = true;
        try {
          const route = ctx.route || routeOf(req, res);
          const status = aborted && !res.headersSent ? null : res.statusCode;
          const failed = aborted || (status !== null && status >= 400);
          const cap = failed ? BODY_CAP_ERROR : BODY_CAP_OK;
          const tenant = tenantNow(ctx);
          const fp = fingerprinterFor(tenant);
          const reqHeaders = plainHeaders(req.headers);
          const resHeaders = plainHeaders(res.getHeaders());
          const reqBody = captureBody(req.body, contentTypeOf(reqHeaders), cap, fp);
          const resBody = captureBody(Buffer.concat(chunks), contentTypeOf(resHeaders), cap, fp);
          const durationMs = Date.now() - started;
          const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
          const line = base(levelFor(status, aborted), `${req.method} ${pathOnly} ${status === null ? 'aborted' : status} ${durationMs}ms`, ctx, tenant);
          line.type = 'span';
          if (route) line.route = route;
          line.span = {
            kind: 'server',
            name: route || `${req.method} ${pathOnly}`,
            parentId: ctx.parentId,
            status,
            durationMs,
            req: { method: req.method, url: fp.text(req.originalUrl || req.url || ''), headers: recordHeaders(req.headers, fp), body: reqBody.value, bytes: reqBody.bytes },
            res: { headers: recordHeaders(res.getHeaders(), fp), body: resBody.value, bytes: overflow ? `>${BODY_CAP_ERROR}` : resBody.bytes },
            truncated: reqBody.truncated || resBody.truncated || overflow,
          };
          write(line);
        } catch {
          // A span not written is a missing span, never a failed request.
        }
      };
      res.on('finish', () => seal(false));
      res.on('close', () => seal(true));
    } catch {
      return next();
    }
    storage.run(ctx, () => next());
  };
}

// ── Client spans ────────────────────────────────────────────────────────────

const STARTED = Symbol('onsellLogStarted');

type Tracked = InternalAxiosRequestConfig & { [STARTED]?: { at: number; spanId: string; ctx: LogContext; detached: boolean } };

function urlOf(config: InternalAxiosRequestConfig): string {
  try {
    return axios.getUri(config);
  } catch {
    const url = config.url || '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || !config.baseURL) return url;
    return `${config.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  }
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
    const existing = storage.getStore();
    const ctx: LogContext = existing || {
      traceId: newTraceId(),
      spanId: newSpanId(),
      parentId: null,
      tenant: null,
      connectionId: null,
      route: null,
    };
    const spanId = newSpanId();
    (config as Tracked)[STARTED] = { at: Date.now(), spanId, ctx, detached: !existing };
    const h = config.headers as unknown as { get?: (n: string) => unknown; set?: (n: string, v: string) => unknown };
    if (options.propagate && h && typeof h.get === 'function' && typeof h.set === 'function' && !h.get('traceparent')) {
      if (options.propagate(urlOf(config))) h.set('traceparent', `00-${ctx.traceId}-${spanId}-00`);
    }
  } catch {
    // Never the reason a call did not go out.
  }
  return config;
}

function finish(config: InternalAxiosRequestConfig | undefined, response: AxiosResponse | undefined, error?: AxiosError): void {
  const started = config ? (config as Tracked)[STARTED] : undefined;
  if (!config || !started) return;
  const { ctx, at, spanId, detached } = started;
  const url = urlOf(config);
  const method = (config.method || 'get').toUpperCase();
  const status = response ? response.status : null;
  const failed = !!error || (status !== null && status >= 400);
  const cap = failed ? BODY_CAP_ERROR : BODY_CAP_OK;
  const reqHeaders = plainHeaders(config.headers);
  const tenant = headerValue(reqHeaders, 'x-tenant-id') || tenantNow(ctx);
  const fp = fingerprinterFor(tenant);
  const resHeaders = plainHeaders(response ? response.headers : undefined);
  const reqBody = captureBody(config.data, contentTypeOf(reqHeaders), cap, fp);
  const resBody = captureBody(response ? response.data : undefined, contentTypeOf(resHeaders), cap, fp);
  const durationMs = Date.now() - at;
  const host = hostOf(url);
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url.split('?')[0];
    }
  })();
  const line = base(levelFor(status, !!error && status === null), `${method} ${host}${path} ${status === null ? (error && error.code) || 'failed' : status} ${durationMs}ms`, ctx, tenant);
  line.type = 'span';
  line.spanId = spanId;
  const connectionId = headerValue(reqHeaders, 'x-connection-id');
  if (connectionId) line.connectionId = connectionId;
  line.span = {
    kind: 'client',
    name: `${method} ${host}`,
    parentId: detached ? null : ctx.spanId,
    status,
    durationMs,
    req: { method, url: fp.text(url), headers: recordHeaders(config.headers, fp), body: reqBody.value, bytes: reqBody.bytes },
    res: { headers: recordHeaders(resHeaders, fp), body: resBody.value, bytes: resBody.bytes },
    truncated: reqBody.truncated || resBody.truncated,
  };
  if (error) {
    const message = fp.text(clip(error.message || 'error', 2000).text);
    line.span.error = error.code ? { message, code: error.code } : { message };
  }
  write(line);
}

function attach(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use(onRequest);
  instance.interceptors.response.use(
    (response) => {
      try {
        finish(response.config, response);
      } catch {
        // The response is what matters.
      }
      return response;
    },
    (error: unknown) => {
      try {
        if (axios.isAxiosError(error)) finish(error.config, error.response, error);
      } catch {
        // The caller must see the original error.
      }
      return Promise.reject(error);
    },
  );
  return instance;
}

/** Test seam: an instance created before install. */
export function attachOnsellLog(instance: AxiosInstance): AxiosInstance {
  return attach(instance);
}

/**
 * Once, from the entry point, right after the demo guard and before any module
 * builds an axios client. Off (and a no-op) unless `logEnabled()` or `force`.
 */
export function installOnsellLog(opts: OnsellLogOptions): boolean {
  if (installed) return true;
  if (!opts.force && !logEnabled()) return false;
  options = opts;
  installed = true;
  installConsole();
  const create = axios.create.bind(axios);
  axios.create = ((config?: Parameters<typeof create>[0]) => attach(create(config))) as typeof axios.create;
  attach(axios as unknown as AxiosInstance);
  return true;
}
