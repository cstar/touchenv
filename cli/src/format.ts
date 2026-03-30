import { encrypt, decrypt, parseKey } from './crypto.js';
import { deriveKey } from './kdf.js';

/** Magic bytes: "TENV\x00\x01" */
const MAGIC_V1 = Buffer.from([0x54, 0x45, 0x4e, 0x56, 0x00, 0x01]);

/** Magic bytes for portable format: "TENV\x00\x02" */
const MAGIC_V2 = Buffer.from([0x54, 0x45, 0x4e, 0x56, 0x00, 0x02]);

const VERSION_V1 = 0x01;
const VERSION_V2 = 0x02;

/** Header = magic (6) + version (1) = 7 bytes */
const HEADER_SIZE = 7;
const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const SALT_SIZE = 16;
/** Total overhead v1: header + nonce + tag = 35 bytes */
const OVERHEAD_V1 = HEADER_SIZE + NONCE_SIZE + TAG_SIZE;
/** Total overhead v2: header + salt + nonce + tag = 51 bytes */
const OVERHEAD_V2 = HEADER_SIZE + SALT_SIZE + NONCE_SIZE + TAG_SIZE;

function buildHeader(version: number): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);
  const magic = version === VERSION_V2 ? MAGIC_V2 : MAGIC_V1;
  magic.copy(header, 0);
  header[6] = version;
  return header;
}

/**
 * Encode a .env plaintext into the .env.encrypted binary format.
 *
 * @param plaintext - UTF-8 .env content
 * @param keyHex    - hex-encoded 256-bit DEK
 * @param nonce     - optional 12-byte nonce (random if omitted)
 * @returns Binary .env.encrypted buffer
 */
export function encodeEncrypted(
  plaintext: string,
  keyHex: string,
  nonce?: Buffer,
): Buffer {
  const key = parseKey(keyHex);
  const header = buildHeader(VERSION_V1);
  const plain = Buffer.from(plaintext, 'utf-8');

  const result = encrypt(key, plain, header, nonce);

  return Buffer.concat([header, result.nonce, result.ciphertext, result.tag]);
}

/**
 * Decode a .env.encrypted binary buffer back to .env plaintext.
 *
 * @param data   - Binary .env.encrypted content
 * @param keyHex - hex-encoded 256-bit DEK
 * @returns UTF-8 .env content
 */
export function decodeEncrypted(data: Buffer, keyHex: string): string {
  if (data.length < OVERHEAD_V1) {
    throw new Error(
      `File too small: expected at least ${OVERHEAD_V1} bytes, got ${data.length}`,
    );
  }

  // Validate magic prefix (first 4 bytes are "TENV")
  const magicPrefix = data.subarray(0, 4);
  if (!magicPrefix.equals(Buffer.from([0x54, 0x45, 0x4e, 0x56]))) {
    throw new Error('Invalid magic bytes: not a touchenv encrypted file');
  }

  // Validate version
  const version = data[6];
  if (version !== VERSION_V1) {
    if (version === VERSION_V2) {
      throw new Error('This is a portable (v2) file — use `touchenv import` to decrypt it');
    }
    throw new Error(`Unsupported version: 0x${version.toString(16).padStart(2, '0')}`);
  }

  const header = data.subarray(0, HEADER_SIZE);
  const nonce = data.subarray(HEADER_SIZE, HEADER_SIZE + NONCE_SIZE);
  const ciphertext = data.subarray(HEADER_SIZE + NONCE_SIZE, data.length - TAG_SIZE);
  const tag = data.subarray(data.length - TAG_SIZE);

  const key = parseKey(keyHex);
  const plain = decrypt(key, nonce, ciphertext, tag, header);

  return plain.toString('utf-8');
}

/**
 * Encode a .env plaintext into the portable v2 format (password-based).
 *
 * @param plaintext - UTF-8 .env content
 * @param password  - Password for key derivation
 * @param salt      - Optional 16-byte salt (random if omitted)
 * @param nonce     - Optional 12-byte nonce (random if omitted)
 * @returns Binary portable .env.portable buffer
 */
export function encodePortable(
  plaintext: string,
  password: string,
  salt?: Buffer,
  nonce?: Buffer,
): Buffer {
  const { key, salt: usedSalt } = deriveKey(password, salt);
  const header = buildHeader(VERSION_V2);
  const plain = Buffer.from(plaintext, 'utf-8');

  const result = encrypt(key, plain, header, nonce);

  return Buffer.concat([header, usedSalt, result.nonce, result.ciphertext, result.tag]);
}

/**
 * Decode a portable v2 file back to .env plaintext.
 *
 * @param data     - Binary portable file content
 * @param password - Password for key derivation
 * @returns UTF-8 .env content
 */
export function decodePortable(data: Buffer, password: string): string {
  // Check magic first (if we have enough bytes) to give helpful error for v1 files
  if (data.length >= HEADER_SIZE) {
    const magic = data.subarray(0, 6);
    if (magic.equals(MAGIC_V1)) {
      throw new Error('This is a v1 file (DEK-based) — use `touchenv decrypt` instead');
    }
    if (!magic.equals(MAGIC_V2)) {
      throw new Error('Invalid magic bytes: not a touchenv portable file');
    }
  }

  if (data.length < OVERHEAD_V2) {
    throw new Error(
      `File too small: expected at least ${OVERHEAD_V2} bytes, got ${data.length}`,
    );
  }

  // Validate magic
  const magic = data.subarray(0, 6);
  if (!magic.equals(MAGIC_V2)) {
    throw new Error('Invalid magic bytes: not a touchenv portable file');
  }

  // Validate version
  const version = data[6];
  if (version !== VERSION_V2) {
    throw new Error(`Unsupported version: 0x${version.toString(16).padStart(2, '0')}`);
  }

  const header = data.subarray(0, HEADER_SIZE);
  const salt = data.subarray(HEADER_SIZE, HEADER_SIZE + SALT_SIZE);
  const nonceStart = HEADER_SIZE + SALT_SIZE;
  const nonce = data.subarray(nonceStart, nonceStart + NONCE_SIZE);
  const ciphertext = data.subarray(nonceStart + NONCE_SIZE, data.length - TAG_SIZE);
  const tag = data.subarray(data.length - TAG_SIZE);

  const { key } = deriveKey(password, Buffer.from(salt));
  const plain = decrypt(key, nonce, ciphertext, tag, header);

  return plain.toString('utf-8');
}
