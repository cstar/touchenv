import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { config, values } from '../src/index.js';
import { encodeEncrypted } from '../src/format.js';

const KEY_HEX = '0123456789abcdef'.repeat(4);
const PLAINTEXT = 'DB_HOST=localhost\nDB_PORT=5432\n';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'touchenv-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env['DB_HOST'];
  delete process.env['DB_PORT'];
});

function writeEncrypted(dir: string): string {
  const data = encodeEncrypted(PLAINTEXT, KEY_HEX);
  const path = join(dir, '.env.encrypted');
  writeFileSync(path, data);
  return path;
}

describe('values()', () => {
  it('returns parsed env without modifying process.env', () => {
    const path = writeEncrypted(tmpDir);
    const env = values({ path, key: KEY_HEX });
    assert.deepEqual(env, { DB_HOST: 'localhost', DB_PORT: '5432' });
    assert.equal(process.env['DB_HOST'], undefined);
  });
});

describe('config()', () => {
  it('loads env vars into process.env', () => {
    const path = writeEncrypted(tmpDir);
    const result = config({ path, key: KEY_HEX });
    assert.deepEqual(result.parsed, { DB_HOST: 'localhost', DB_PORT: '5432' });
    assert.equal(result.error, undefined);
    assert.equal(process.env['DB_HOST'], 'localhost');
    assert.equal(process.env['DB_PORT'], '5432');
  });

  it('does not override existing env vars by default', () => {
    const path = writeEncrypted(tmpDir);
    process.env['DB_HOST'] = 'original';
    config({ path, key: KEY_HEX });
    assert.equal(process.env['DB_HOST'], 'original');
  });

  it('overrides existing env vars when override=true', () => {
    const path = writeEncrypted(tmpDir);
    process.env['DB_HOST'] = 'original';
    config({ path, key: KEY_HEX, override: true });
    assert.equal(process.env['DB_HOST'], 'localhost');
  });

  it('returns error for missing file', () => {
    const result = config({ path: '/nonexistent/.env.encrypted', key: KEY_HEX });
    assert.ok(result.error);
    assert.deepEqual(result.parsed, {});
  });

  it('returns error for missing key', () => {
    const path = writeEncrypted(tmpDir);
    const savedKey = process.env['TOUCHENV_KEY'];
    delete process.env['TOUCHENV_KEY'];
    const result = config({ path });
    assert.ok(result.error);
    if (savedKey) process.env['TOUCHENV_KEY'] = savedKey;
  });
});
