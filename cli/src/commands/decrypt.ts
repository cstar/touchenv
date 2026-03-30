import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodeEncrypted } from '../format.js';
import { resolveKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';
const PLAINTEXT_FALLBACK = '.env';
const MIGRATION_WARNING =
  '[touchenv] Warning: .env.encrypted not found, falling back to plaintext .env file. '
  + 'Run `touchenv init` to encrypt your .env file for secure storage.';

export const decryptCommand = new Command('decrypt')
  .description('Decrypt .env.encrypted to stdout')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (opts: { dir: string }) => {
    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    if (!existsSync(encFile)) {
      const plainFile = resolve(projectDir, PLAINTEXT_FALLBACK);
      if (existsSync(plainFile)) {
        console.warn(MIGRATION_WARNING);
        process.stdout.write(readFileSync(plainFile, 'utf-8'));
        return;
      }
      console.error(`error: ${ENCRYPTED_FILE} not found (run 'touchenv init' first)`);
      process.exit(1);
    }

    const hexKey = await resolveKey(projectDir);
    const data = readFileSync(encFile);
    const plaintext = decodeEncrypted(data, hexKey);

    process.stdout.write(plaintext);
  });
