import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export interface EncryptResult {
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
}

export function parseKey(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('DEK must be exactly 64 hex characters (256 bits)');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(
  key: Buffer,
  plain: Buffer,
  aad: Buffer,
  nonce?: Buffer,
): EncryptResult {
  const iv = nonce ?? randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { nonce: iv, ciphertext: encrypted, tag };
}

export function decrypt(
  key: Buffer,
  nonce: Buffer,
  ciphertext: Buffer,
  tag: Buffer,
  aad: Buffer,
): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
