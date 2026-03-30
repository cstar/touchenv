import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encrypt, decrypt, parseKey, generateKey, generateNonce } from '../src/crypto.js';

const vectorsPath = join(import.meta.dirname, '..', '..', 'spec', 'test-vectors', 'all-vectors.json');
const vectors = JSON.parse(readFileSync(vectorsPath, 'utf-8')).vectors;

describe('parseKey', () => {
  it('parses a valid 64-char hex string', () => {
    const key = parseKey('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    assert.equal(key.length, 32);
  });

  it('rejects short hex string', () => {
    assert.throws(() => parseKey('0123'), /64 hex characters/);
  });

  it('rejects non-hex characters', () => {
    assert.throws(() => parseKey('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'), /64 hex characters/);
  });

  it('rejects empty string', () => {
    assert.throws(() => parseKey(''), /64 hex characters/);
  });
});

describe('encrypt / decrypt round-trip', () => {
  it('encrypts and decrypts back to original', () => {
    const key = generateKey();
    const plain = Buffer.from('hello world', 'utf-8');
    const aad = Buffer.from([0x54, 0x45, 0x4e, 0x56, 0x00, 0x01, 0x01]);

    const { nonce, ciphertext, tag } = encrypt(key, plain, aad);
    const result = decrypt(key, nonce, ciphertext, tag, aad);

    assert.deepEqual(result, plain);
  });

  it('fails with wrong key', () => {
    const key1 = generateKey();
    const key2 = generateKey();
    const plain = Buffer.from('secret', 'utf-8');
    const aad = Buffer.from([0x01]);

    const { nonce, ciphertext, tag } = encrypt(key1, plain, aad);

    assert.throws(() => decrypt(key2, nonce, ciphertext, tag, aad));
  });

  it('fails with tampered ciphertext', () => {
    const key = generateKey();
    const plain = Buffer.from('secret', 'utf-8');
    const aad = Buffer.from([0x01]);

    const { nonce, ciphertext, tag } = encrypt(key, plain, aad);
    ciphertext[0] ^= 0xff; // tamper

    assert.throws(() => decrypt(key, nonce, ciphertext, tag, aad));
  });

  it('fails with wrong AAD', () => {
    const key = generateKey();
    const plain = Buffer.from('secret', 'utf-8');
    const aad1 = Buffer.from([0x01]);
    const aad2 = Buffer.from([0x02]);

    const { nonce, ciphertext, tag } = encrypt(key, plain, aad1);

    assert.throws(() => decrypt(key, nonce, ciphertext, tag, aad2));
  });
});

describe('test vectors — crypto', () => {
  for (const vector of vectors) {
    it(`encrypts "${vector.name}" to match test vector`, () => {
      const key = parseKey(vector.dek);
      const nonce = Buffer.from(vector.nonce, 'hex');
      const aad = Buffer.from(vector.aad, 'hex');
      const plain = Buffer.from(vector.plaintext, 'utf-8');

      const result = encrypt(key, plain, aad, nonce);

      // The full encrypted output is header + nonce + ciphertext + tag
      // We verify just the crypto output matches
      const expectedFull = Buffer.from(vector.encrypted, 'hex');
      // ciphertext starts after header(7) + nonce(12) = 19, ends at len-16
      const expectedCiphertext = expectedFull.subarray(19, expectedFull.length - 16);
      const expectedTag = expectedFull.subarray(expectedFull.length - 16);

      assert.deepEqual(result.ciphertext, expectedCiphertext);
      assert.deepEqual(result.tag, expectedTag);
    });

    it(`decrypts "${vector.name}" from test vector`, () => {
      const key = parseKey(vector.dek);
      const nonce = Buffer.from(vector.nonce, 'hex');
      const aad = Buffer.from(vector.aad, 'hex');

      const expectedFull = Buffer.from(vector.encrypted, 'hex');
      const ciphertext = expectedFull.subarray(19, expectedFull.length - 16);
      const tag = expectedFull.subarray(expectedFull.length - 16);

      const result = decrypt(key, nonce, ciphertext, tag, aad);
      assert.equal(result.toString('utf-8'), vector.plaintext);
    });
  }
});

describe('generateKey / generateNonce', () => {
  it('generates 32-byte key', () => {
    assert.equal(generateKey().length, 32);
  });

  it('generates 12-byte nonce', () => {
    assert.equal(generateNonce().length, 12);
  });

  it('generates unique keys', () => {
    const a = generateKey();
    const b = generateKey();
    assert.notDeepEqual(a, b);
  });
});
