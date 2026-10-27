/**
 * The log contract (onsell_kstock_infra_boot docs/central-logs.md) as this
 * repo carries it. Written by `npm run logs:contract-sync`; do not edit the
 * copies or the digests by hand — change the upstream and sync every repo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createKeyedFingerprinter, fingerprintLabel, poolStoreKey } from '../src/utils/onsellFingerprint';
import { logEnabled } from '../src/utils/onsellLog';

const ROOT = join(__dirname, '..');
const digest = (path: string) => createHash('sha256').update(readFileSync(join(ROOT, path))).digest('hex');

test('the contract is the upstream, byte for byte', () => {
  assert.equal(digest('src/utils/onsellLog.ts'), '8a51c5efe30e20d49031e7dc51c9829d35c98a4b69861cd18030fae183940e94');
  assert.equal(digest('src/utils/onsellFingerprint.ts'), '296743d2f832952b3606f8f81b173063ee389b3c3f0c1b1540a932c597043a55');
  assert.equal(digest('test/fixtures/fingerprint-vectors.json'), '0f6122508209453bae117e04beb441385b66ed6c505b529ed1f4607e3961f243');
});

test('every golden vector fingerprints exactly as the control plane does', () => {
  const vectors = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/fingerprint-vectors.json'), 'utf8'));
  for (const c of vectors.cases) {
    const key =
      c.tier === 'shared'
        ? poolStoreKey(createHmac('sha256', vectors.master).update('onsell-log-fingerprint-pool').digest(), c.tenant)
        : createHmac('sha256', vectors.master).update(fingerprintLabel(c.tenant)).digest();
    const f = createKeyedFingerprinter(key);
    const out = c.kind === 'text' ? f.text(c.input) : f.value(c.input);
    assert.deepEqual(out, c.output);
    assert.equal(f.count, c.replaced);
    for (const secret of c.secrets) assert.ok(!JSON.stringify(out).includes(secret));
  }
});

test('stays off under the test runner', () => {
  assert.equal(logEnabled(), process.env.NODE_ENV === 'production' || process.env.ONSELL_LOG_FORMAT === 'json');
});
