import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeEncrypted, encodeEncrypted } from '../src/format.js';
import { parse } from '../src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vectorsPath = resolve(__dirname, '..', '..', '..', 'spec', 'test-vectors', 'all-vectors.json');
const vectorsData = JSON.parse(readFileSync(vectorsPath, 'utf-8'));
const vectors: Array<{
  name: string;
  dek: string;
  nonce: string;
  plaintext: string;
  encrypted: string;
  env: Record<string, string>;
}> = vectorsData.vectors;

describe('test vectors', () => {
  for (const vector of vectors) {
    describe(vector.name, () => {
      it('decrypts correctly', () => {
        const encrypted = Buffer.from(vector.encrypted, 'hex');
        const plaintext = decodeEncrypted(encrypted, vector.dek);
        assert.equal(plaintext, vector.plaintext);
      });

      it('encrypts deterministically with same nonce', () => {
        const nonce = Buffer.from(vector.nonce, 'hex');
        const result = encodeEncrypted(vector.plaintext, vector.dek, nonce);
        assert.equal(result.toString('hex'), vector.encrypted);
      });

      it('parses plaintext to expected env', () => {
        const env = parse(vector.plaintext);
        assert.deepEqual(env, vector.env);
      });
    });
  }
});
