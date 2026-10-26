/**
 * The feedback trace (r3-svc-trace): what a sampled call from node_api records,
 * what it sends back, and that no credential reaches either.
 *
 * Shared byte-for-byte between trendyol and emag. The upstream is a local
 * server on an ephemeral port; no network, no fixed port, no state left
 * behind for another file.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import axios from 'axios';
import express from 'express';

import {
  clearStore,
  encodeSpanHeader,
  feedbackTraceMiddleware,
  HEADER_MAX_BYTES,
  handlerManifest,
  parseTraceparent,
  SPAN_HEADER,
  traceRecordHandler,
  type Span,
  type TraceRecordJson,
} from '../src/utils/feedbackTrace';
import { redactUrl, scrubText } from '../src/utils/feedback-redact';

const ROOT = join(__dirname, '..');
const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const PARENT_ID = '00f067aa0ba902b7';
const SAMPLED = `00-${TRACE_ID}-${PARENT_ID}-01`;

// ── Every header name this service's source sets or reads ──────────────────

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

function headerNames(): string[] {
  const names = new Set<string>(['authorization', 'proxy-authorization', 'cookie', 'x-internal-api-key', 'x-api-key']);
  const patterns = [
    /['"]([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)['"]\s*:/g,
    /['"](Authorization|Cookie)['"]\s*:/g,
    /(?:setHeader|\.set|\.header)\(\s*['"]([A-Za-z][A-Za-z0-9-]+)['"]/g,
    /headers\[\s*['"]([A-Za-z][A-Za-z0-9-]+)['"]\s*\]/g,
  ];
  for (const file of [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'api'))]) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) names.add(match[1].toLowerCase());
    }
  }
  return [...names].filter((name) => !FRAMING.has(name)).sort();
}

/** Headers that frame the request itself; a synthetic value would break the call, not test it. */
const FRAMING = new Set([
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'expect',
  'upgrade',
  'te',
  'traceparent',
]);

// ── The upstream and the service under test ────────────────────────────────

let upstream: http.Server;
let upstreamUrl = '';
const upstreamSaw: http.IncomingHttpHeaders[] = [];

let service: http.Server;
let serviceUrl = '';

const SECRETS = new Map<string, string>();

before(async () => {
  upstream = http.createServer((req, res) => {
    upstreamSaw.push(req.headers);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Set-Cookie', 'session=Plain0Cookievalue');
    res.statusCode = req.url?.startsWith('/fail') ? 500 : 200;
    res.end(JSON.stringify({ ok: res.statusCode === 200 }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

  headerNames().forEach((name, i) => SECRETS.set(name, `Plain${i}Secretvalue`));
  const secretHeaders = Object.fromEntries(SECRETS);

  const app = express();
  const files = { '/api/things': 'api/routes/things.ts' };
  const things = express.Router();
  things.get('/:id', async (req, res) => {
    const client = axios.create({ baseURL: upstreamUrl, headers: secretHeaders });
    console.log('Authorization: Basic c3ludGhldGljLWtleTpzeW50aGV0aWMtc2VjcmV0LTAwMDE=');
    console.log('client ion.popescu@gmail.com');
    const ok = await client.get(`/ok/${req.params.id}`, { params: { token: 'Plain1Querysecret' } });
    // What an error handler does with a failed call: inspect the whole error.
    await client.get('/fail').catch((err) => console.error('[ERROR] upstream:', err));
    console.log('got', ok);
    res.json({ id: req.params.id });
  });
  app.get('/internal/trace/:traceId', traceRecordHandler('svc'));
  app.use('/api', feedbackTraceMiddleware('svc', files));
  app.use('/api/things', (req, res, next) => {
    res.locals.mountPath = req.baseUrl;
    next();
  }, things);
  app.get('/handlers', (_req, res) => res.json(handlerManifest(app, files)));

  service = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => service.once('listening', resolve));
  serviceUrl = `http://127.0.0.1:${(service.address() as AddressInfo).port}`;
});

after(() => {
  upstream.close();
  service.close();
});

beforeEach(() => {
  clearStore();
  upstreamSaw.length = 0;
});

async function call(traceparent?: string) {
  const res = await axios.get(`${serviceUrl}/api/things/42?x=1`, {
    headers: traceparent ? { traceparent } : {},
  });
  return res;
}

// ── Tests ──────────────────────────────────────────────────────────────────

test('the redactor is node_api\'s, byte for byte, and passes its vectors', () => {
  const digest = (path: string) => createHash('sha256').update(readFileSync(join(ROOT, path))).digest('hex');
  assert.equal(digest('src/utils/feedback-redact.ts'), '31cb502adc8ab1dc5de4e33dffcacf5df61c60cc6557619be92c7aae0d223221');
  // emag's push protection refuses the synthetic Shopify tokens in the vectors,
  // so emag pins the redactor alone; node_api, web and trendyol run the vectors
  // against the same bytes.
  if (!existsSync(join(ROOT, 'test/fixtures/redact-vectors.json'))) return;
  assert.equal(digest('test/fixtures/redact-vectors.json'), 'b24833f308f82673bf4ff34bc0d0c4bce21a918d1a95acc8a51d31d255a89264');

  const { vectors } = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/redact-vectors.json'), 'utf8')) as {
    vectors: { kind: string; input: string; expected?: string; origin?: string }[];
  };
  for (const v of vectors) {
    const out = v.kind === 'url' ? redactUrl(v.input, v.origin) : scrubText(v.input);
    assert.equal(out, v.kind === 'keep' ? v.input : v.expected, `${v.kind}: ${v.input}`);
  }
});

test('a sampled call sends its spans back, parented to the caller', async () => {
  const res = await call(SAMPLED);
  const raw = res.headers[SPAN_HEADER.toLowerCase()];
  assert.equal(typeof raw, 'string');
  assert.ok(Buffer.byteLength(raw as string) <= HEADER_MAX_BYTES);

  const { spans } = JSON.parse(raw as string) as { spans: Span[] };
  const [server, ...clients] = spans;
  assert.equal(server.kind, 'server');
  assert.equal(server.traceId, TRACE_ID);
  assert.equal(server.parentSpanId, PARENT_ID);
  assert.equal(server.service, 'svc');
  assert.equal(server.handler, 'GET /api/things/:id');
  assert.equal(server.attrs['code.filepath'], 'api/routes/things.ts');
  assert.equal(server.attrs['http.target'], '/api/things/42?x=***');
  assert.match(server.startNs, /^\d{19}$/);

  assert.equal(clients.length, 2);
  for (const span of clients) {
    assert.equal(span.kind, 'client');
    assert.equal(span.parentSpanId, server.spanId);
    assert.equal(span.traceId, TRACE_ID);
  }
  assert.equal(clients[0].attrs['http.url'], `${upstreamUrl}/ok/42?token=***`);
  assert.equal(clients[0].status, 'ok');
  assert.equal(clients[1].status, 'error');
  assert.equal(clients[1].attrs['http.status_code'], 500);
});

test('no traceparent of ours reaches the upstream', async () => {
  await call(SAMPLED);
  assert.equal(upstreamSaw.length, 2);
  for (const headers of upstreamSaw) {
    assert.equal(headers.traceparent, undefined);
    assert.ok(!JSON.stringify(headers).includes(TRACE_ID));
  }
});

test('the full record waits for node_api, logs scrubbed', async () => {
  await call(SAMPLED);
  await call(SAMPLED);
  const res = await axios.get<TraceRecordJson>(`${serviceUrl}/internal/trace/${TRACE_ID}`);
  assert.equal(res.data.traceId, TRACE_ID);
  assert.equal(res.data.calls.length, 2);
  const [first] = res.data.calls;
  assert.equal(first.server.durMs !== null, true);
  assert.equal(first.spans.length, 2);
  const messages = first.logs.map((l) => l.message);
  assert.deepEqual(messages, [
    'Authorization: Basic «token»',
    'client «email»',
    `[ERROR] upstream: [axios GET ${upstreamUrl}/fail → 500] Request failed with status code 500`,
    `got [axios GET ${upstreamUrl}/ok/42?token=*** → 200] response`,
  ]);

  const missing = await axios.get(`${serviceUrl}/internal/trace/${'a'.repeat(32)}`, { validateStatus: () => true });
  assert.equal(missing.status, 404);
  const bad = await axios.get(`${serviceUrl}/internal/trace/nope`, { validateStatus: () => true });
  assert.equal(bad.status, 400);
});

test('an unsampled call records nothing and sends no header', async () => {
  const res = await call(`00-${TRACE_ID}-${PARENT_ID}-00`);
  assert.equal(res.headers[SPAN_HEADER.toLowerCase()], undefined);
  const none = await call();
  assert.equal(none.headers[SPAN_HEADER.toLowerCase()], undefined);
  const record = await axios.get(`${serviceUrl}/internal/trace/${TRACE_ID}`, { validateStatus: () => true });
  assert.equal(record.status, 404);
});

test(`no credential, under any of this service's header names, is in the header or the record`, async () => {
  const names = headerNames();
  assert.ok(names.includes('x-internal-api-key'));
  assert.ok(names.length >= 5, `found ${names.length} header names`);

  const res = await call(SAMPLED);
  const record = await axios.get(`${serviceUrl}/internal/trace/${TRACE_ID}`);
  const kept = `${res.headers[SPAN_HEADER.toLowerCase()]}\n${JSON.stringify(record.data)}`;

  assert.ok(upstreamSaw.length > 0);
  for (const [name, secret] of SECRETS) {
    assert.equal(upstreamSaw[0][name], secret, `the upstream really received ${name}`);
    assert.ok(!kept.includes(secret), `${name} leaked`);
    assert.ok(!kept.toLowerCase().includes(`"${name}"`), `${name} recorded as a key`);
  }
  for (const leak of ['Plain1Querysecret', 'Plain0Cookievalue', 'c3ludGhldGljLWtleTpzeW50aGV0aWMtc2VjcmV0LTAwMDE', 'ion.popescu']) {
    assert.ok(!kept.includes(leak), `${leak} leaked`);
  }
});

test('the header is cut to 3 KB, server span first', () => {
  const span = (i: number): Span => ({
    traceId: TRACE_ID,
    spanId: i.toString(16).padStart(16, '0'),
    parentSpanId: PARENT_ID,
    service: 'svc',
    handler: null,
    name: `GET api.example.ro ${'ă'.repeat(20)}`,
    kind: i === 0 ? 'server' : 'client',
    status: 'ok',
    startNs: '1761500000000000000',
    durMs: 1,
    attrs: { 'http.url': `https://api.example.ro/${'x'.repeat(200)}` },
    events: [],
  });
  const text = encodeSpanHeader(span(0), Array.from({ length: 40 }, (_, i) => span(i + 1)));
  assert.ok(Buffer.byteLength(text) <= HEADER_MAX_BYTES);
  assert.ok(/^[\x20-\x7e]*$/.test(text), 'header stays ASCII');
  const parsed = JSON.parse(text) as { spans: Span[]; truncated?: boolean };
  assert.equal(parsed.truncated, true);
  assert.equal(parsed.spans[0].kind, 'server');
  assert.ok(parsed.spans.length > 1);
  assert.equal(parsed.spans[0].name, span(0).name);
});

test('the handler manifest lists every route with its file', async () => {
  const res = await axios.get(`${serviceUrl}/handlers`);
  assert.deepEqual(res.data, [{ handler: 'GET /api/things/:id', file: 'api/routes/things.ts' }]);
});

test('traceparent parsing is strict W3C', () => {
  assert.deepEqual(parseTraceparent(SAMPLED), { traceId: TRACE_ID, parentId: PARENT_ID, sampled: true });
  assert.equal(parseTraceparent(`00-${'0'.repeat(32)}-${PARENT_ID}-01`), null);
  assert.equal(parseTraceparent('garbage'), null);
  assert.equal(parseTraceparent(`ff-${TRACE_ID}-${PARENT_ID}-01`), null);
});
