import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Bundled Swift helper at dist/bin/touchenv-keychain (macOS only),
// fall back to 'touchenv-keychain' on PATH for dev installs.
const BUNDLED = resolve(dirname(fileURLToPath(import.meta.url)), 'bin', 'touchenv-keychain');
const BIN = existsSync(BUNDLED) ? BUNDLED : 'touchenv-keychain';

export function keychainRetrieve(account: string): string | null {
  if (process.platform !== 'darwin') return null;
  try {
    const out = execFileSync(BIN, ['retrieve', account], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.trim();
  } catch {
    return null;
  }
}
