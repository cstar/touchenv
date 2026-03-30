import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { encodeEncrypted, decodeEncrypted } from '../src/format.js';

const KEY_HEX = '0123456789abcdef'.repeat(4);

describe('encodeEncrypted / decodeEncrypted', () => {
  it('round-trips plaintext', () => {
    const plaintext = 'DB_HOST=localhost\nDB_PORT=5432\n';
    const encrypted = encodeEncrypted(plaintext, KEY_HEX);
    const result = decodeEncrypted(encrypted, KEY_HEX);
    assert.equal(result, plaintext);
  });

  it('round-trips empty plaintext', () => {
    const encrypted = encodeEncrypted('', KEY_HEX);
    const result = decodeEncrypted(encrypted, KEY_HEX);
    assert.equal(result, '');
  });

  it('round-trips unicode content', () => {
    const plaintext = 'EMOJI=\u{1F680}\nJP=\u6771\u4EAC\n';
    const encrypted = encodeEncrypted(plaintext, KEY_HEX);
    const result = decodeEncrypted(encrypted, KEY_HEX);
    assert.equal(result, plaintext);
  });

  it('rejects file too small', () => {
    assert.throws(
      () => decodeEncrypted(Buffer.alloc(10), KEY_HEX),
      /too small/,
    );
  });

  it('rejects invalid magic bytes', () => {
    const bad = Buffer.alloc(40);
    bad[0] = 0xff;
    assert.throws(
      () => decodeEncrypted(bad, KEY_HEX),
      /Invalid magic/,
    );
  });

  it('rejects wrong version', () => {
    const encrypted = encodeEncrypted('X=1', KEY_HEX);
    encrypted[6] = 0x99;
    assert.throws(
      () => decodeEncrypted(encrypted, KEY_HEX),
      /Unsupported version/,
    );
  });

  it('rejects wrong key', () => {
    const encrypted = encodeEncrypted('X=1', KEY_HEX);
    const wrongKey = 'fedcba9876543210'.repeat(4);
    assert.throws(
      () => decodeEncrypted(encrypted, wrongKey),
    );
  });
});
