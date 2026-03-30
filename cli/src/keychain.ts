import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { generateKey } from './crypto.js';

const KEYCHAIN_BIN = 'touchenv-keychain';

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
