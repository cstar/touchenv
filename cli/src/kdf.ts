import { randomBytes } from 'node:crypto';
import { argon2id } from '@noble/hashes/argon2.js';

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

// Argon2id parameters per FORMAT.md spec
const ARGON2_M = 65536; // 64 MiB memory
const ARGON2_T = 3;     // 3 iterations
const ARGON2_P = 4;     // 4 parallel lanes

/**
 * Derive a 256-bit DEK from a password using Argon2id.
 *
 * @param password - User-supplied password
 * @param salt     - 16-byte salt (random if omitted)
 * @returns { key, salt } — 32-byte derived key and salt used
 */
export function deriveKey(
  password: string,
  salt?: Buffer,
): { key: Buffer; salt: Buffer } {
  const s = salt ?? randomBytes(SALT_LENGTH);
  if (s.length !== SALT_LENGTH) {
    throw new Error(`Salt must be ${SALT_LENGTH} bytes`);
  }

  const passwordBytes = Buffer.from(password, 'utf-8');
  const derived = argon2id(passwordBytes, s, {
    t: ARGON2_T,
    m: ARGON2_M,
    p: ARGON2_P,
    dkLen: KEY_LENGTH,
  });

  return { key: Buffer.from(derived), salt: s };
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}
