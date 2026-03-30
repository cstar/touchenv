import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeEncrypted, decodeEncrypted } from '../src/format.js';

const vectorsPath = join(import.meta.dirname, '..', '..', 'spec', 'test-vectors', 'all-vectors.json');
const vectors = JSON.parse(readFileSync(vectorsPath, 'utf-8')).vectors;

describe('encodeEncrypted / decodeEncrypted round-trip', () => {
  it('round-trips plaintext through encode/decode', () => {
    const plaintext = 'FOO=bar\nBAZ=qux\n';
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const encoded = encodeEncrypted(plaintext, key);
    const decoded = decodeEncrypted(encoded, key);

    assert.equal(decoded, plaintext);
  });

  it('round-trips empty plaintext', () => {
    const plaintext = '';
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const encoded = encodeEncrypted(plaintext, key);
    const decoded = decodeEncrypted(encoded, key);

    assert.equal(decoded, plaintext);
  });
});

describe('encodeEncrypted — binary layout', () => {
  it('starts with correct magic bytes', () => {
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const encoded = encodeEncrypted('X=1\n', key);

    assert.equal(encoded[0], 0x54); // T
    assert.equal(encoded[1], 0x45); // E
    assert.equal(encoded[2], 0x4e); // N
    assert.equal(encoded[3], 0x56); // V
    assert.equal(encoded[4], 0x00);
    assert.equal(encoded[5], 0x01);
  });

  it('has version byte 0x01 at offset 6', () => {
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const encoded = encodeEncrypted('X=1\n', key);

    assert.equal(encoded[6], 0x01);
  });

  it('has correct total size (plaintext + 35 overhead)', () => {
    const plaintext = 'HELLO=world\n';
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const encoded = encodeEncrypted(plaintext, key);

    assert.equal(encoded.length, Buffer.byteLength(plaintext, 'utf-8') + 35);
  });
});

describe('decodeEncrypted — error handling', () => {
  it('rejects file that is too small', () => {
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    assert.throws(
      () => decodeEncrypted(Buffer.alloc(10), key),
      /too small/,
    );
  });

  it('rejects invalid magic bytes', () => {
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const bad = Buffer.alloc(40);
    bad.write('NOTM', 0);
    assert.throws(
      () => decodeEncrypted(bad, key),
      /Invalid magic/,
    );
  });

  it('rejects unsupported version', () => {
    const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const bad = Buffer.alloc(40);
    // Write valid magic
    Buffer.from([0x54, 0x45, 0x4e, 0x56, 0x00, 0x01]).copy(bad, 0);
    bad[6] = 0x99; // bad version
    assert.throws(
      () => decodeEncrypted(bad, key),
      /Unsupported version/,
    );
  });

  it('rejects wrong key', () => {
    const key1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const key2 = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    const encoded = encodeEncrypted('SECRET=data\n', key1);
    assert.throws(() => decodeEncrypted(encoded, key2));
  });
});

describe('test vectors — format', () => {
  for (const vector of vectors) {
    it(`encodes "${vector.name}" to match test vector`, () => {
      const nonce = Buffer.from(vector.nonce, 'hex');
      const encoded = encodeEncrypted(vector.plaintext, vector.dek, nonce);
      const expected = Buffer.from(vector.encrypted, 'hex');

      assert.deepEqual(encoded, expected);
    });

    it(`decodes "${vector.name}" from test vector hex`, () => {
      const data = Buffer.from(vector.encrypted, 'hex');
      const result = decodeEncrypted(data, vector.dek);

      assert.equal(result, vector.plaintext);
    });

    it(`decodes "${vector.name}" from test vector base64`, () => {
      const data = Buffer.from(vector.encrypted_base64, 'base64');
      const result = decodeEncrypted(data, vector.dek);

      assert.equal(result, vector.plaintext);
    });
  }
});
