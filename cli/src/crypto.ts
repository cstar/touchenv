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

/**
 * Parse a hex-encoded 256-bit DEK into a Buffer.
 * Throws if the key is not exactly 64 hex characters.
 */
export function parseKey(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('DEK must be exactly 64 hex characters (256 bits)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param key    - 32-byte DEK
 * @param plain  - UTF-8 plaintext buffer
 * @param aad    - Additional Authenticated Data (header bytes)
 * @param nonce  - Optional 12-byte nonce (random if omitted)
 */
export function encrypt(
  key: Buffer,
  plain: Buffer,
  aad: Buffer,
  nonce?: Buffer,
): EncryptResult {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }
  const iv = nonce ?? randomBytes(NONCE_LENGTH);
  if (iv.length !== NONCE_LENGTH) {
    throw new Error(`Nonce must be ${NONCE_LENGTH} bytes`);
  }

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(aad);

  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { nonce: iv, ciphertext: encrypted, tag };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 *
 * @param key        - 32-byte DEK
 * @param nonce      - 12-byte IV
 * @param ciphertext - encrypted payload
 * @param tag        - 16-byte GCM auth tag
 * @param aad        - Additional Authenticated Data (header bytes)
 * @returns Decrypted plaintext buffer
 */
export function decrypt(
  key: Buffer,
  nonce: Buffer,
  ciphertext: Buffer,
  tag: Buffer,
  aad: Buffer,
): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Nonce must be ${NONCE_LENGTH} bytes`);
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Tag must be ${TAG_LENGTH} bytes`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_LENGTH });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted;
}

export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

export function generateNonce(): Buffer {
  return randomBytes(NONCE_LENGTH);
}
