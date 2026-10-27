/**
 * Credential fingerprints — the log contract's one irreversible step.
 *
 * Copied byte-for-byte beside `onsellLog.ts` into node_api and every
 * TypeScript service, and used unchanged by the control plane's ingest, so a
 * credential fingerprinted in a container and one fingerprinted at ingest
 * produce the same string. Upstream: onsell_kstock_infra_boot
 * `src/control-plane/logs/contract/`. Each copy's test pins its digest and
 * replays `fingerprint-vectors.json`.
 *
 *   [cred:basic acct=seller@krivas.ro h:3f9a01c2d4 n:14]
 *   [cred:bearer h:91be07aa3c n:48]
 *   [cred:api_key n:32]          no key configured: length only
 *
 * `h` is HMAC-SHA256 under the tenant's key, first 10 hex: the same secret in
 * one tenant always gives the same `h`, so "is this the stored token?" is a
 * string comparison; two tenants never share a key. A plain hash is not used
 * because a short password's hash prefix can be reversed offline.
 *
 * Keys (the control plane holds the master and derives the rest):
 *
 *   dedicated  LOG_FINGERPRINT_KEY = HMAC(master, "onsell-log-fingerprint:<tenant>")
 *   pool       LOG_FINGERPRINT_POOL_BASE = HMAC(master, "onsell-log-fingerprint-pool");
 *              a store's key = HMAC(base, "onsell-log-fingerprint:<store>")
 *
 * Only `crypto` and ES2016 built-ins: the services compile to ES2016 with no
 * `lib` override.
 */
import { createHmac } from 'crypto';

export const FINGERPRINT_PREFIX = '[cred:';

/** Field and header names whose value is a credential, after camelCase → snake and `-` → `_`. */
const SECRET_NAMES = new Set([
  'password',
  'passwd',
  'pwd',
  'pass',
  'secret',
  'client_secret',
  'api_secret',
  'apisecret',
  'api_key',
  'apikey',
  'x_api_key',
  'access_token',
  'accesstoken',
  'refresh_token',
  'refreshtoken',
  'id_token',
  'token',
  'auth_token',
  'authtoken',
  'private_key',
  'privatekey',
  'subscription_key',
  'x_internal_api_key',
  'x_health_api_key',
  'x_shopify_access_token',
  'x_onsell_identity_key',
  'x_worker_token',
  'authorization',
  'proxy_authorization',
  'cookie',
  'set_cookie',
  'x_auth_token',
  'session_token',
  'app_secret',
  'webhook_secret',
  'encryption_key',
]);

/**
 * Pagination and continuation tokens are addresses, not credentials, and an
 * agent comparing two pages needs to read them.
 */
const NOT_SECRET_TOKEN = /(^|_)(page|cursor|continuation|next|prev|previous|sync|csrf_form)_token$/;
const SECRET_SUFFIX = /(^|_)(password|passwd|secret|token|api_key|private_key|subscription_key|access_key|secret_key|identity_key|encryption_key)$/;

/**
 * camelCase is split first: the connection schema's encrypted fields are
 * `clientSecret`, `subscriptionKey`, `sagaPassword`, `v3Token`.
 */
export function isSecretName(name: string): boolean {
  const snake = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/-/g, '_');
  if (SECRET_NAMES.has(snake) || SECRET_NAMES.has(name.toLowerCase().replace(/-/g, '_'))) return true;
  return SECRET_SUFFIX.test(snake) && !NOT_SECRET_TOKEN.test(snake);
}

export function fingerprintLabel(tenant: string | null): string {
  return `onsell-log-fingerprint:${tenant || 'platform'}`;
}

/** A store's key on the pool, from the host's base. */
export function poolStoreKey(base: Buffer, tenant: string): Buffer {
  return createHmac('sha256', base).update(fingerprintLabel(tenant)).digest();
}

/** `key` null: no key configured; fingerprints carry the kind and length only. */
export function fingerprintValue(kind: string, value: string, key: Buffer | null, account?: string): string {
  const acct = account ? ` acct=${account}` : '';
  if (!key) return `${FINGERPRINT_PREFIX}${kind}${acct} n:${value.length}]`;
  const h = createHmac('sha256', key).update(value).digest('hex').slice(0, 10);
  return `${FINGERPRINT_PREFIX}${kind}${acct} h:${h} n:${value.length}]`;
}

export interface Fingerprinter {
  /** Credentials replaced so far by this instance. */
  count: number;
  text(input: string): string;
  /** A header or field value, already known to be secret by its name. */
  named(name: string, value: string): string;
  /** Deep copy with every secret-named field and every secret-shaped string fingerprinted. */
  value<T>(input: T): T;
}

type Fp = (kind: string, v: string, acct?: string) => string;

function authValue(fp: Fp, raw: string, key: Buffer | null): string {
  // Already a fingerprint (ingest re-reads what a service wrote): fingerprinting
  // it again would replace the account with the length of the first one.
  if (/^(Basic|Bearer|Token|Digest)\s+\[cred:/i.test(raw.trim())) return raw;
  const m = /^(Basic|Bearer|Token|Digest)\s+(\S+)$/i.exec(raw.trim());
  if (!m) return fp('authorization', raw);
  const scheme = m[1].toLowerCase();
  if (scheme === 'basic') {
    const decoded = Buffer.from(m[2], 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    if (colon > 0 && /^[\x20-\x7e]+$/.test(decoded)) {
      // eMAG's user is the seller's email and says which account was used;
      // Trendyol's is the API key, which is itself a credential.
      const user = decoded.slice(0, colon);
      const account = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(user)
        ? user
        : key
          ? `~h:${createHmac('sha256', key).update(user).digest('hex').slice(0, 10)}`
          : `~n:${user.length}`;
      return `Basic ${fp('basic', decoded.slice(colon + 1), account)}`;
    }
    return `Basic ${fp('basic', m[2])}`;
  }
  return `${m[1]} ${fp(scheme, m[2])}`;
}

// A credential printed inline: `Authorization: Basic …`, `"apiKey":"…"`,
// `password=…&`, `x-shopify-access-token: shpat_…`. Group 1 is the name with
// its separator, group 3 the value; quotes are kept outside the value.
const NAME_ALTERNATION = Array.from(SECRET_NAMES)
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/_/g, '[-_]?'))
  .concat('[a-z0-9_-]*?(?:password|passwd|secret|token)')
  .join('|');
const INLINE_RE = new RegExp(
  `((?:["']?)\\b(?:${NAME_ALTERNATION})\\b["']?\\s*[:=]\\s*)(["']?)((?:Basic|Bearer|Token)\\s+[^\\s"',;&}\\]]+|[^\\s"',;&}\\]]{4,})\\2`,
  'gi',
);
// `token: undefined` in a message is a statement about a missing credential.
const NOT_A_VALUE = new Set(['undefined', 'null', 'true', 'false', 'none', 'missing', 'empty', 'required']);
// Shapes that are a credential wherever they appear, named or not.
const SHAPE_RES: { kind: string; re: RegExp }[] = [
  { kind: 'shopify', re: /\bshp(?:at|ca|ss|pa|ua)_[A-Fa-f0-9]{32}\b/g },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { kind: 'agent', re: /\bonsell_agent_[A-Za-z0-9_-]{16,}\b/g },
  { kind: 'bearer', re: /\bBearer\s+([A-Za-z0-9._~+/|=-]{12,})/g },
  { kind: 'basic', re: /\bBasic\s+([A-Za-z0-9+/]{12,}={0,2})(?![A-Za-z0-9+/=])/g },
];

export function createKeyedFingerprinter(key: Buffer | null): Fingerprinter {
  const state: Fingerprinter = { count: 0, text, named, value };

  function fp(kind: string, v: string, account?: string): string {
    state.count += 1;
    return fingerprintValue(kind, v, key, account);
  }

  function named(name: string, raw: string): string {
    if (raw.indexOf(FINGERPRINT_PREFIX) === 0 || raw.length === 0) return raw;
    const n = name.toLowerCase().replace(/-/g, '_');
    if (n === 'authorization' || n === 'proxy_authorization') return authValue(fp, raw, key);
    if (n === 'cookie' || n === 'set_cookie') {
      return raw.replace(/(^|;\s*)([^=;\s]+)=([^;]*)/g, (_m: string, sep: string, k: string, v: string) =>
        v.indexOf(FINGERPRINT_PREFIX) === 0 ? `${sep}${k}=${v}` : `${sep}${k}=${fp('cookie', v)}`,
      );
    }
    return fp(n, raw);
  }

  function text(input: string): string {
    if (!input) return input;
    let out = input.replace(INLINE_RE, (whole: string, head: string, quote: string, val: string) => {
      if (val.indexOf(FINGERPRINT_PREFIX) !== -1 || val.charAt(0) === '[' || NOT_A_VALUE.has(val.toLowerCase())) {
        return whole;
      }
      const name = head.replace(/["'\s:=]/g, '');
      if (!isSecretName(name)) return whole;
      return `${head}${quote}${named(name, val)}${quote}`;
    });
    for (const { kind, re } of SHAPE_RES) {
      out = out.replace(re, (whole: string, group?: string) => {
        if (kind === 'bearer') return `Bearer ${fp('bearer', group as string)}`;
        if (kind === 'basic') return authValue(fp, whole, key);
        return fp(kind, whole);
      });
    }
    return out;
  }

  function value<T>(input: T): T {
    return walk(input, 0) as T;
  }

  function walk(v: unknown, depth: number): unknown {
    if (depth > 32) return v;
    if (typeof v === 'string') return text(v);
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    if (v && typeof v === 'object') {
      const src = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(src)) {
        const x = src[k];
        if (isSecretName(k) && (typeof x === 'string' || typeof x === 'number')) {
          out[k] = named(k, String(x));
        } else if (isSecretName(k) && Array.isArray(x)) {
          out[k] = x.map((item) => (typeof item === 'string' ? named(k, item) : walk(item, depth + 1)));
        } else {
          out[k] = walk(x, depth + 1);
        }
      }
      return out;
    }
    return v;
  }

  return state;
}
