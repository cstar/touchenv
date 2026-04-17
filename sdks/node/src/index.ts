import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { decodeEncrypted, encodeEncrypted } from './format.js';
import { keychainRetrieve } from './keychain.js';
import { parse } from './parser.js';

export { decodeEncrypted, encodeEncrypted } from './format.js';
export { parse } from './parser.js';

const DEFAULT_PATH = '.env.encrypted';
const PLAINTEXT_FALLBACK = '.env';

const MIGRATION_WARNING =
  '[touchenv] Warning: .env.encrypted not found, falling back to plaintext .env file. '
  + 'Run `touchenv init` to encrypt your .env file for secure storage.';

export interface ConfigOptions {
  path?: string;
  key?: string;
  override?: boolean;
}

export interface ConfigOutput {
  parsed: Record<string, string>;
  error?: Error;
}

// Resolve the DEK. Priority:
//   1. Explicit `key` option
//   2. TOUCHENV_KEY env var (CI/headless)
//   3. macOS login Keychain (via touchenv-keychain helper) — account = CWD
function getKey(explicit?: string, projectDir: string = process.cwd()): string {
  if (explicit) return explicit;

  const envKey = process.env['TOUCHENV_KEY'];
  if (envKey) return envKey;

  const chainKey = keychainRetrieve(resolve(projectDir));
  if (chainKey) return chainKey;

  throw new Error(
    'touchenv: DEK not found. Set TOUCHENV_KEY (64-char hex), '
    + 'or run `touchenv init` to store one in the macOS login Keychain.',
  );
}

/**
 * Resolve the .env file to read: prefers .env.encrypted, falls back to plaintext .env.
 * Returns { filePath, encrypted } indicating which file was found.
 */
function resolveEnvFile(explicitPath?: string): { filePath: string; encrypted: boolean } {
  if (explicitPath) {
    return { filePath: resolve(explicitPath), encrypted: true };
  }

  const encPath = resolve(DEFAULT_PATH);
  if (existsSync(encPath)) {
    return { filePath: encPath, encrypted: true };
  }

  const plainPath = resolve(PLAINTEXT_FALLBACK);
  if (existsSync(plainPath)) {
    console.warn(MIGRATION_WARNING);
    return { filePath: plainPath, encrypted: false };
  }

  // Neither exists — return encrypted path so the caller gets a normal "file not found" error
  return { filePath: encPath, encrypted: true };
}

/**
 * Decrypt, parse, and load an .env.encrypted file into process.env.
 * Falls back to plaintext .env if .env.encrypted is missing.
 *
 * Drop-in replacement for dotenv.config().
 */
export function config(options: ConfigOptions = {}): ConfigOutput {
  try {
    const { filePath, encrypted } = resolveEnvFile(options.path);

    let parsed: Record<string, string>;
    if (encrypted) {
      const dek = getKey(options.key);
      const data = readFileSync(filePath);
      const plaintext = decodeEncrypted(Buffer.from(data), dek);
      parsed = parse(plaintext);
    } else {
      const plaintext = readFileSync(filePath, 'utf-8');
      parsed = parse(plaintext);
    }

    for (const [k, v] of Object.entries(parsed)) {
      if (options.override || !(k in process.env)) {
        process.env[k] = v;
      }
    }

    return { parsed };
  } catch (error) {
    return { parsed: {}, error: error as Error };
  }
}

/**
 * Decrypt and parse without modifying process.env.
 * Falls back to plaintext .env if .env.encrypted is missing.
 */
export function values(options: Omit<ConfigOptions, 'override'> = {}): Record<string, string> {
  const { filePath, encrypted } = resolveEnvFile(options.path);

  if (encrypted) {
    const dek = getKey(options.key);
    const data = readFileSync(filePath);
    const plaintext = decodeEncrypted(Buffer.from(data), dek);
    return parse(plaintext);
  }

  const plaintext = readFileSync(filePath, 'utf-8');
  return parse(plaintext);
}
