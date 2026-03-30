import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseKey, encrypt, decrypt } from '../src/crypto.js';

describe('parseKey', () => {
  it('parses valid 64-char hex key', () => {
    const hex = '0123456789abcdef'.repeat(4);
    const key = parseKey(hex);
    assert.equal(key.length, 32);
  });

  it('rejects short key', () => {
    assert.throws(() => parseKey('0123'), /64 hex characters/);
  });

  it('rejects non-hex characters', () => {
    assert.throws(() => parseKey('g'.repeat(64)), /64 hex characters/);
  });

  it('rejects empty string', () => {
    assert.throws(() => parseKey(''), /64 hex characters/);
  });
});

describe('encrypt/decrypt round-trip', () => {
  it('round-trips arbitrary plaintext', () => {
    const key = parseKey('0123456789abcdef'.repeat(4));
    const plain = Buffer.from('hello world', 'utf-8');
    const aad = Buffer.from('header');

    const { nonce, ciphertext, tag } = encrypt(key, plain, aad);
    const decrypted = decrypt(key, nonce, ciphertext, tag, aad);

    assert.equal(decrypted.toString('utf-8'), 'hello world');
  });

  it('fails with wrong key', () => {
    const key1 = parseKey('0123456789abcdef'.repeat(4));
    const key2 = parseKey('fedcba9876543210'.repeat(4));
    const plain = Buffer.from('secret', 'utf-8');
    const aad = Buffer.from('header');

    const { nonce, ciphertext, tag } = encrypt(key1, plain, aad);
    assert.throws(() => decrypt(key2, nonce, ciphertext, tag, aad));
  });

  it('fails with tampered ciphertext', () => {
    const key = parseKey('0123456789abcdef'.repeat(4));
    const plain = Buffer.from('secret', 'utf-8');
    const aad = Buffer.from('header');

    const { nonce, ciphertext, tag } = encrypt(key, plain, aad);
    ciphertext[0] ^= 0xff;
    assert.throws(() => decrypt(key, nonce, ciphertext, tag, aad));
  });
});
