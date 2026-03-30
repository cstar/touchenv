import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { decodeEncrypted, encodeEncrypted } from './format.js';
import { parse } from './parser.js';

export { decodeEncrypted, encodeEncrypted } from './format.js';
export { parse } from './parser.js';

const DEFAULT_PATH = '.env.encrypted';

export interface ConfigOptions {
  path?: string;
  key?: string;
  override?: boolean;
}

export interface ConfigOutput {
  parsed: Record<string, string>;
  error?: Error;
}

function getKey(explicit?: string): string {
  const key = explicit ?? process.env['TOUCHENV_KEY'];
  if (!key) {
    throw new Error(
      'TOUCHENV_KEY environment variable not set. '
      + 'Set it to a 64-char hex DEK, or use touchenv-keychain on macOS.',
    );
  }
  return key;
}

/**
 * Decrypt, parse, and load an .env.encrypted file into process.env.
 *
 * Drop-in replacement for dotenv.config().
 */
export function config(options: ConfigOptions = {}): ConfigOutput {
  try {
    const filePath = resolve(options.path ?? DEFAULT_PATH);
    const dek = getKey(options.key);
    const data = readFileSync(filePath);
    const plaintext = decodeEncrypted(Buffer.from(data), dek);
    const parsed = parse(plaintext);

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
 */
export function values(options: Omit<ConfigOptions, 'override'> = {}): Record<string, string> {
  const filePath = resolve(options.path ?? DEFAULT_PATH);
  const dek = getKey(options.key);
  const data = readFileSync(filePath);
  const plaintext = decodeEncrypted(Buffer.from(data), dek);
  return parse(plaintext);
}
