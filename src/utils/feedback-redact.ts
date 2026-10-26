/**
 * The one redactor for everything feedback keeps: request and console rings
 * in the browser now, server spans later.
 *
 * Headers are an allowlist, query values are never kept, and every free-text
 * string goes through `scrubText`. It has no imports and touches no browser
 * global, because node_api carries a byte-for-byte copy of this file and both
 * copies are held to `redact-vectors.json`.
 */

export const REDACTED = "***";

export const HEADER_ALLOWLIST: readonly string[] = ["content-type", "x-request-id", "traceparent", "x-connection-id"];

const KEPT_HEADERS = new Set(HEADER_ALLOWLIST);

export type HeaderValue = string | number | readonly string[] | null | undefined;
export type HeaderSource = Iterable<readonly [string, string]> | Record<string, HeaderValue> | null | undefined;

const EMAIL = "«email»";
const PHONE = "«telefon»";
const TOKEN = "«token»";
const CNP = "«CNP»";
const IBAN = "«IBAN»";

const AUTH_SCHEME = /\b(Bearer|Basic)(\s+)([A-Za-z0-9._~+/=-]+)/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const SHOPIFY_TOKEN = /\bshp(?:at|ca|pa|ss)_[A-Za-z0-9]+/g;
const EMAIL_ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const RO_IBAN = /\bRO\d{2} ?[A-Z]{4}(?: ?[A-Z0-9]{4}){4}\b/g;
const ANY_IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g;
const LONG_HEX = /\b[0-9a-fA-F]{32,}\b/g;
const LONG_ENCODED = /[A-Za-z0-9+/_-]{40,}={0,2}/g;
const CNP_RUN = /(^|\D)([1-9]\d{12})(?!\d)/g;
const RO_PHONE =
  /(^|[^\w+])(?:(?:\+|00)40[\s.-]?|0)(?:7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}|2\d[\s.-]?\d{3}[\s.-]?\d{4}|[23]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})(?!\d)/g;
/** A W3C trace id is 32 hex characters and is what makes a report traceable, not a secret. */
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}/;

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

function isCnp(digits: string): boolean {
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));
  const county = Number(digits.slice(7, 9));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (!((county >= 1 && county <= 52) || county === 70)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * CNP_WEIGHTS[i];
  const check = sum % 11 === 10 ? 1 : sum % 11;
  return check === Number(digits[12]);
}

function isIbanChecksum(candidate: string): boolean {
  const compact = candidate.replace(/ /g, "");
  if (compact.length < 15 || compact.length > 34) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const value = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Random-looking: mixed case and digits, which slugs, SKUs and words are not. */
function looksEncoded(run: string): boolean {
  return /[A-Z]/.test(run) && /[a-z]/.test(run) && /\d/.test(run);
}

function scrubEncoded(run: string): string {
  if (!run.includes("/")) return looksEncoded(run) ? TOKEN : run;
  const segments = run.split("/");
  const pathLike = run.startsWith("/") || segments.some((s) => /^[a-z][a-z-]{2,}$/.test(s));
  if (!pathLike && looksEncoded(run)) return TOKEN;
  return segments.map((s) => (s.length >= 40 && looksEncoded(s) ? TOKEN : s)).join("/");
}

/** Credentials and personal data in free text, replaced by stable placeholders. */
export function scrubText(text: string): string {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(AUTH_SCHEME, (match, scheme: string, space: string, credential: string) =>
      credential.length >= 16 || /\d/.test(credential) ? `${scheme}${space}${TOKEN}` : match
    )
    .replace(JWT, TOKEN)
    .replace(SHOPIFY_TOKEN, TOKEN)
    .replace(EMAIL_ADDRESS, EMAIL)
    .replace(RO_IBAN, IBAN)
    .replace(ANY_IBAN, (match) => (isIbanChecksum(match) ? IBAN : match))
    .replace(LONG_HEX, (match, offset: number, whole: string) =>
      TRACEPARENT.test(whole.slice(Math.max(0, offset - 3))) ? match : TOKEN
    )
    .replace(LONG_ENCODED, scrubEncoded)
    .replace(CNP_RUN, (match, before: string, digits: string) => (isCnp(digits) ? `${before}${CNP}` : match))
    .replace(RO_PHONE, (_match, before: string) => `${before}${PHONE}`);
}

function headerText(value: HeaderValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value.length ? value.join(", ") : undefined;
}

/** Only the allowlisted headers, with lower-cased names; everything else is dropped. */
export function redactHeaders(headers: HeaderSource): Record<string, string> {
  const kept: Record<string, string> = {};
  if (!headers) return kept;
  const entries: Iterable<readonly [string, HeaderValue]> =
    Symbol.iterator in headers
      ? (headers as Iterable<readonly [string, string]>)
      : Object.entries(headers as Record<string, HeaderValue>);
  for (const [name, value] of entries) {
    const key = name.toLowerCase();
    const text = headerText(value);
    if (KEPT_HEADERS.has(key) && text !== undefined) kept[key] = text;
  }
  return kept;
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Path plus query keys; every query value becomes `***` and the fragment is
 * dropped. The origin is left off when it is `origin`, or when `raw` was relative.
 */
export function redactUrl(raw: string, origin = ""): string {
  const absolute = /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//");
  let url: URL;
  try {
    url = new URL(raw, origin || "http://localhost");
  } catch {
    return scrubText(decode(raw.split(/[?#]/)[0]));
  }
  const keys = [...url.searchParams.keys()];
  const query = keys.length ? `?${keys.map((key) => `${key}=${REDACTED}`).join("&")}` : "";
  const prefix = absolute && url.origin !== origin ? url.origin : "";
  return `${prefix}${scrubText(decode(url.pathname))}${query}`;
}
