import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { encodePortable, decodePortable, encodeEncrypted, decodeEncrypted } from '../src/format.js';
import { deriveKey } from '../src/kdf.js';
import { generateKey } from '../src/crypto.js';

const CLI_PATH = join(import.meta.dirname, '..', 'src', 'cli.ts');
const TSX = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsx');

function run(args: string[], env?: Record<string, string>): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(TSX, [CLI_PATH, ...args], {
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      timeout: 30000,
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      status: err.status ?? 1,
    };
  }
}

describe('deriveKey — Argon2id KDF', () => {
  it('derives a 32-byte key from password and salt', () => {
    const salt = Buffer.alloc(16, 0xaa);
    const { key } = deriveKey('test-password', salt);
    assert.equal(key.length, 32);
  });

  it('produces deterministic output for same inputs', () => {
    const salt = Buffer.alloc(16, 0xbb);
    const { key: k1 } = deriveKey('password1', salt);
    const { key: k2 } = deriveKey('password1', salt);
    assert.deepEqual(k1, k2);
  });

  it('produces different output for different passwords', () => {
    const salt = Buffer.alloc(16, 0xcc);
    const { key: k1 } = deriveKey('password1', salt);
    const { key: k2 } = deriveKey('password2', salt);
    assert.notDeepEqual(k1, k2);
  });

  it('produces different output for different salts', () => {
    const salt1 = Buffer.alloc(16, 0x01);
    const salt2 = Buffer.alloc(16, 0x02);
    const { key: k1 } = deriveKey('password', salt1);
    const { key: k2 } = deriveKey('password', salt2);
    assert.notDeepEqual(k1, k2);
  });

  it('generates random salt if not provided', () => {
    const { salt: s1 } = deriveKey('password');
    const { salt: s2 } = deriveKey('password');
    assert.notDeepEqual(s1, s2);
  });

  it('rejects wrong salt length', () => {
    assert.throws(
      () => deriveKey('password', Buffer.alloc(8)),
      /Salt must be 16 bytes/,
    );
  });
});

describe('encodePortable / decodePortable round-trip', () => {
  it('round-trips plaintext through portable format', () => {
    const plaintext = 'FOO=bar\nBAZ=qux\n';
    const password = 'test-password-123';

    const encoded = encodePortable(plaintext, password);
    const decoded = decodePortable(encoded, password);

    assert.equal(decoded, plaintext);
  });

  it('round-trips empty plaintext', () => {
    const encoded = encodePortable('', 'pw');
    const decoded = decodePortable(encoded, 'pw');
    assert.equal(decoded, '');
  });

  it('round-trips unicode content', () => {
    const plaintext = 'EMOJI=\u{1F512}\nJP=\u3053\u3093\u306B\u3061\u306F\n';
    const encoded = encodePortable(plaintext, 'unicode-pw');
    const decoded = decodePortable(encoded, 'unicode-pw');
    assert.equal(decoded, plaintext);
  });

  it('fails with wrong password', () => {
    const encoded = encodePortable('SECRET=data\n', 'correct-pw');
    assert.throws(() => decodePortable(encoded, 'wrong-pw'));
  });
});

describe('encodePortable — binary layout', () => {
  it('starts with v2 magic bytes', () => {
    const encoded = encodePortable('X=1\n', 'pw');
    assert.equal(encoded[0], 0x54); // T
    assert.equal(encoded[1], 0x45); // E
    assert.equal(encoded[2], 0x4e); // N
    assert.equal(encoded[3], 0x56); // V
    assert.equal(encoded[4], 0x00);
    assert.equal(encoded[5], 0x02); // v2
  });

  it('has version byte 0x02 at offset 6', () => {
    const encoded = encodePortable('X=1\n', 'pw');
    assert.equal(encoded[6], 0x02);
  });

  it('has correct total size (plaintext + 51 overhead)', () => {
    const plaintext = 'HELLO=world\n';
    const encoded = encodePortable(plaintext, 'pw');
    // header(7) + salt(16) + nonce(12) + ciphertext(=plaintext.length) + tag(16) = 51 + plaintext
    assert.equal(encoded.length, Buffer.byteLength(plaintext, 'utf-8') + 51);
  });
});

describe('decodePortable — error handling', () => {
  it('rejects file that is too small', () => {
    // A buffer too small even for a header gets "invalid magic"
    assert.throws(
      () => decodePortable(Buffer.alloc(5), 'pw'),
      /too small/,
    );
  });

  it('rejects file with v2 magic but truncated body', () => {
    // Valid v2 header but not enough data for salt+nonce+tag
    const buf = Buffer.alloc(20);
    Buffer.from([0x54, 0x45, 0x4e, 0x56, 0x00, 0x02]).copy(buf, 0);
    buf[6] = 0x02;
    assert.throws(
      () => decodePortable(buf, 'pw'),
      /too small/,
    );
  });

  it('rejects v1 files with helpful message', () => {
    const v1 = encodeEncrypted('X=1\n', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    assert.throws(
      () => decodePortable(v1, 'pw'),
      /v1 file.*touchenv decrypt/,
    );
  });

  it('rejects invalid magic bytes', () => {
    const bad = Buffer.alloc(60);
    bad.write('NOTM', 0);
    assert.throws(
      () => decodePortable(bad, 'pw'),
      /Invalid magic/,
    );
  });
});

describe('decodeEncrypted — v2 rejection', () => {
  it('rejects v2 files with helpful message', () => {
    const v2 = encodePortable('X=1\n', 'pw');
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    assert.throws(
      () => decodeEncrypted(v2, key),
      /portable.*touchenv import/,
    );
  });
});

describe('CLI export/import commands', () => {
  let tmpDir: string;
  let hexKey: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'touchenv-portable-'));
    hexKey = generateKey().toString('hex');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('export creates a portable file', () => {
    const content = 'DB_HOST=localhost\nDB_PORT=5432\n';
    const enc = encodeEncrypted(content, hexKey);
    writeFileSync(join(tmpDir, '.env.encrypted'), enc);
    const outPath = join(tmpDir, 'test.portable');

    const result = run(
      ['export', '-d', tmpDir, '-o', outPath],
      { TOUCHENV_KEY: hexKey, TOUCHENV_PASSWORD: 'test-pw' },
    );
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);

    // Verify the file was created and can be decoded
    const portableData = readFileSync(outPath);
    assert.equal(portableData[6], 0x02); // v2 format
    const decoded = decodePortable(portableData, 'test-pw');
    assert.equal(decoded, content);
  });

  it('export fails without .env.encrypted', () => {
    const result = run(
      ['export', '-d', tmpDir],
      { TOUCHENV_KEY: hexKey, TOUCHENV_PASSWORD: 'pw' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not found/);
  });

  it('import decrypts portable file to stdout', () => {
    const content = 'SECRET=hunter2\n';
    const portable = encodePortable(content, 'import-pw');
    const portablePath = join(tmpDir, 'test.portable');
    writeFileSync(portablePath, portable);

    const result = run(
      ['import', portablePath, '-d', tmpDir, '--stdout'],
      { TOUCHENV_PASSWORD: 'import-pw' },
    );
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.equal(result.stdout, content);
  });

  it('import re-encrypts into .env.encrypted', () => {
    const content = 'IMPORTED=yes\n';
    const portable = encodePortable(content, 'import-pw');
    const portablePath = join(tmpDir, 'test.portable');
    writeFileSync(portablePath, portable);

    const result = run(
      ['import', portablePath, '-d', tmpDir],
      { TOUCHENV_KEY: hexKey, TOUCHENV_PASSWORD: 'import-pw' },
    );
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);

    // Verify the .env.encrypted was created with the local DEK
    const encData = readFileSync(join(tmpDir, '.env.encrypted'));
    const decrypted = decodeEncrypted(encData, hexKey);
    assert.equal(decrypted, content);
  });

  it('import fails with wrong password', () => {
    const portable = encodePortable('X=1\n', 'correct');
    const portablePath = join(tmpDir, 'test.portable');
    writeFileSync(portablePath, portable);

    const result = run(
      ['import', portablePath, '-d', tmpDir, '--stdout'],
      { TOUCHENV_PASSWORD: 'wrong' },
    );
    assert.equal(result.status, 1);
  });

  it('import refuses to overwrite without --force', () => {
    writeFileSync(join(tmpDir, '.env.encrypted'), Buffer.alloc(35));
    const portable = encodePortable('X=1\n', 'pw');
    const portablePath = join(tmpDir, 'test.portable');
    writeFileSync(portablePath, portable);

    const result = run(
      ['import', portablePath, '-d', tmpDir],
      { TOUCHENV_KEY: hexKey, TOUCHENV_PASSWORD: 'pw' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /already exists/);
  });

  it('help shows export and import commands', () => {
    const result = run(['--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /export/);
    assert.match(result.stdout, /import/);
  });
});
