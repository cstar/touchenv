#!/usr/bin/env node

/**
 * Generate canonical test vectors for the touchenv encrypted file format.
 *
 * Each vector is a self-contained JSON object with deterministic inputs
 * (key, nonce) so every implementation can reproduce the exact ciphertext.
 *
 * Usage: node generate.mjs
 */

import { createCipheriv, createDecipheriv } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Format constants (from FORMAT.md)
// ---------------------------------------------------------------------------

const MAGIC = Buffer.from([0x54, 0x45, 0x4e, 0x56, 0x00, 0x01]); // TENV\x00\x01
const VERSION = 0x01;
const HEADER = Buffer.concat([MAGIC, Buffer.from([VERSION])]); // 7 bytes — also the AAD
const NONCE_LEN = 12;
const TAG_LEN = 16;
const OVERHEAD = MAGIC.length + 1 + NONCE_LEN + TAG_LEN; // 35

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encrypt plaintext using AES-256-GCM with the touchenv format. */
function encrypt(dek, nonce, plaintext) {
  const key = Buffer.from(dek, "hex");
  const iv = Buffer.from(nonce, "hex");
  const pt = Buffer.from(plaintext, "utf-8");

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(HEADER);

  const ciphertext = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();

  // magic || version || nonce || ciphertext || tag
  return Buffer.concat([HEADER, iv, ciphertext, tag]);
}

/** Decrypt an encrypted buffer — used to verify round-trip. */
function decrypt(dek, encrypted) {
  const key = Buffer.from(dek, "hex");
  const magic = encrypted.subarray(0, 6);
  const version = encrypted[6];
  const nonce = encrypted.subarray(7, 19);
  const ciphertext = encrypted.subarray(19, encrypted.length - TAG_LEN);
  const tag = encrypted.subarray(encrypted.length - TAG_LEN);

  if (!magic.equals(MAGIC)) throw new Error("bad magic");
  if (version !== VERSION) throw new Error("bad version");

  const aad = encrypted.subarray(0, 7); // magic || version
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

/** Build a single test-vector object. */
function makeVector({ name, description, dek, nonce, plaintext, env }) {
  const encrypted = encrypt(dek, nonce, plaintext);

  // Verify round-trip
  const decrypted = decrypt(dek, encrypted);
  if (decrypted !== plaintext) {
    throw new Error(`Round-trip failed for vector "${name}"`);
  }

  return {
    name,
    description,
    format_version: 1,
    encryption: "aes-256-gcm",
    dek,
    nonce,
    aad: HEADER.toString("hex"),
    plaintext,
    encrypted: encrypted.toString("hex"),
    encrypted_base64: encrypted.toString("base64"),
    env,
  };
}

// ---------------------------------------------------------------------------
// Deterministic test keys & nonces (NOT for production use)
// ---------------------------------------------------------------------------

const TEST_DEK_1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_DEK_2 = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

const NONCE_1 = "aabbccddeeff00112233aabb";
const NONCE_2 = "112233445566778899aabbcc";
const NONCE_3 = "ffeeddccbbaa998877665544";
const NONCE_4 = "000102030405060708090a0b";

// ---------------------------------------------------------------------------
// Vector definitions
// ---------------------------------------------------------------------------

const vectors = [
  // 1. Basic — simple key=value pairs
  makeVector({
    name: "basic",
    description: "Simple key=value pairs with comments and blank lines",
    dek: TEST_DEK_1,
    nonce: NONCE_1,
    plaintext: `# Database config
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp

# App settings
APP_ENV=development
DEBUG=true
SECRET_KEY=s3cret
EMPTY_VAL=
`,
    env: {
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_NAME: "myapp",
      APP_ENV: "development",
      DEBUG: "true",
      SECRET_KEY: "s3cret",
      EMPTY_VAL: "",
    },
  }),

  // 2. Multiline — double-quoted values with escape sequences
  makeVector({
    name: "multiline",
    description: "Double-quoted values with \\n, \\t, and other escape sequences",
    dek: TEST_DEK_1,
    nonce: NONCE_2,
    plaintext: `RSA_KEY="-----BEGIN RSA PRIVATE KEY-----\\nMIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn\\nbase64encodeddata\\n-----END RSA PRIVATE KEY-----"
GREETING="Hello,\\tWorld!\\nWelcome to \\"touchenv\\"."
MULTI="line1\\nline2\\nline3"
ESCAPED="backslash: \\\\ quote: \\""
`,
    env: {
      RSA_KEY:
        "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn\nbase64encodeddata\n-----END RSA PRIVATE KEY-----",
      GREETING: 'Hello,\tWorld!\nWelcome to "touchenv".',
      MULTI: "line1\nline2\nline3",
      ESCAPED: 'backslash: \\ quote: "',
    },
  }),

  // 3. Unicode — various UTF-8 encoded values
  makeVector({
    name: "unicode",
    description: "UTF-8 encoded values with emoji, CJK, accented, and RTL characters",
    dek: TEST_DEK_2,
    nonce: NONCE_3,
    plaintext: `EMOJI=\u{1F512}\u{1F510}\u{1F511}
JAPANESE=\u{3053}\u{3093}\u{306B}\u{3061}\u{306F}\u{4E16}\u{754C}
ACCENTED=caf\u{00E9} cr\u{00E8}me br\u{00FB}l\u{00E9}e
ARABIC=\u{0645}\u{0631}\u{062D}\u{0628}\u{0627}
MATH=\u{2200}x \u{2208} \u{2124}: x\u{00B2} \u{2265} 0
MIXED=hello-\u{4E16}\u{754C}-\u{1F30D}
`,
    env: {
      EMOJI: "\u{1F512}\u{1F510}\u{1F511}",
      JAPANESE: "\u{3053}\u{3093}\u{306B}\u{3061}\u{306F}\u{4E16}\u{754C}",
      ACCENTED: "caf\u{00E9} cr\u{00E8}me br\u{00FB}l\u{00E9}e",
      ARABIC: "\u{0645}\u{0631}\u{062D}\u{0628}\u{0627}",
      MATH: "\u{2200}x \u{2208} \u{2124}: x\u{00B2} \u{2265} 0",
      MIXED: "hello-\u{4E16}\u{754C}-\u{1F30D}",
    },
  }),

  // 4. Portable — exercises all parsing rules (quoted, unquoted, export, single-quoted)
  makeVector({
    name: "portable",
    description:
      "Exercises all dotenv parsing rules: unquoted, double-quoted, single-quoted, export prefix, duplicate keys",
    dek: TEST_DEK_2,
    nonce: NONCE_4,
    plaintext: `# All parsing rule variants
UNQUOTED=simple value
DOUBLE_QUOTED="value with spaces"
SINGLE_QUOTED='literal $HOME \\n not expanded'
export EXPORTED=exported_value
NO_VALUE=

# Duplicate — last wins
DUP=first
DUP=second

# Trimming
TRIMMED=  spaces around
`,
    env: {
      UNQUOTED: "simple value",
      DOUBLE_QUOTED: "value with spaces",
      SINGLE_QUOTED: "literal $HOME \\n not expanded",
      EXPORTED: "exported_value",
      NO_VALUE: "",
      DUP: "second",
      TRIMMED: "spaces around",
    },
  }),
];

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

// Write individual vector files
for (const v of vectors) {
  const path = join(__dirname, `${v.name}.json`);
  writeFileSync(path, JSON.stringify(v, null, 2) + "\n");
  console.log(`wrote ${path}`);
}

// Write combined file
const allPath = join(__dirname, "all-vectors.json");
writeFileSync(allPath, JSON.stringify({ vectors }, null, 2) + "\n");
console.log(`wrote ${allPath}`);

console.log(`\n${vectors.length} test vectors generated successfully.`);
