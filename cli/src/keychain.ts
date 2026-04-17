import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKey } from './crypto.js';

// Resolve bundled Swift binary at dist/bin/touchenv-keychain, fall back to PATH.
const BUNDLED_BIN = resolve(dirname(fileURLToPath(import.meta.url)), 'bin', 'touchenv-keychain');
const KEYCHAIN_BIN = existsSync(BUNDLED_BIN) ? BUNDLED_BIN : 'touchenv-keychain';

/**
 * Resolve the DEK for the current project.
 *
 * Priority:
 * 1. TOUCHENV_KEY env var (CI/headless)
 * 2. macOS Keychain via touchenv-keychain binary
 */
export async function resolveKey(projectDir: string): Promise<string> {
  const envKey = process.env['TOUCHENV_KEY'];
  if (envKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(envKey)) {
      throw new Error('TOUCHENV_KEY must be exactly 64 hex characters (256 bits)');
    }
    return envKey;
  }
  return keychainRetrieve(resolve(projectDir));
}

/**
 * Store a DEK in the macOS Keychain.
 */
export async function keychainStore(account: string, hexKey: string): Promise<void> {
  await runKeychain('store', account, hexKey);
}

/**
 * Retrieve a DEK from the macOS Keychain.
 */
export async function keychainRetrieve(account: string): Promise<string> {
  const result = await runKeychain('retrieve', account);
  return result.trim();
}

/**
 * Check if a DEK exists in the macOS Keychain.
 */
export async function keychainExists(account: string): Promise<boolean> {
  try {
    await runKeychain('exists', account);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a new DEK and store it in the Keychain.
 * Returns the hex-encoded key.
 */
export async function generateAndStoreKey(projectDir: string): Promise<string> {
  const key = generateKey();
  const hexKey = key.toString('hex');
  const account = resolve(projectDir);
  await keychainStore(account, hexKey);
  return hexKey;
}

function runKeychain(...args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(KEYCHAIN_BIN, args, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr.trim() || error.message;
        reject(new Error(msg));
        return;
      }
      resolve(stdout);
    });
  });
}
