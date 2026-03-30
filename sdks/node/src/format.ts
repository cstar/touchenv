import { encrypt, decrypt, parseKey } from './crypto.js';

const MAGIC = Buffer.from([0x54, 0x45, 0x4e, 0x56, 0x00, 0x01]);
const VERSION = 0x01;
const HEADER_SIZE = 7;
const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const OVERHEAD = HEADER_SIZE + NONCE_SIZE + TAG_SIZE;

function buildHeader(): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);
  MAGIC.copy(header, 0);
  header[6] = VERSION;
  return header;
}

export function encodeEncrypted(
  plaintext: string,
  keyHex: string,
  nonce?: Buffer,
): Buffer {
  const key = parseKey(keyHex);
  const header = buildHeader();
  const plain = Buffer.from(plaintext, 'utf-8');
  const result = encrypt(key, plain, header, nonce);
  return Buffer.concat([header, result.nonce, result.ciphertext, result.tag]);
}

export function decodeEncrypted(data: Buffer, keyHex: string): string {
  if (data.length < OVERHEAD) {
    throw new Error(
      `File too small: expected at least ${OVERHEAD} bytes, got ${data.length}`,
    );
  }

  const magic = data.subarray(0, 6);
  if (!magic.equals(MAGIC)) {
    throw new Error('Invalid magic bytes: not a touchenv encrypted file');
  }

  const version = data[6];
  if (version !== VERSION) {
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
