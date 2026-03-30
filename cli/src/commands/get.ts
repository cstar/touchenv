import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodeEncrypted } from '../format.js';
import { parse } from '../parser.js';
import { resolveKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';
const PLAINTEXT_FALLBACK = '.env';
const MIGRATION_WARNING =
  '[touchenv] Warning: .env.encrypted not found, falling back to plaintext .env file. '
  + 'Run `touchenv init` to encrypt your .env file for secure storage.';

export const getCommand = new Command('get')
  .description('Get an environment variable from .env.encrypted')
  .argument('<key>', 'Variable name')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (key: string, opts: { dir: string }) => {
    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    let env: Record<string, string>;

    if (!existsSync(encFile)) {
      const plainFile = resolve(projectDir, PLAINTEXT_FALLBACK);
      if (existsSync(plainFile)) {
        console.warn(MIGRATION_WARNING);
        const plaintext = readFileSync(plainFile, 'utf-8');
        ({ env } = parse(plaintext));
      } else {
        console.error(`error: ${ENCRYPTED_FILE} not found (run 'touchenv init' first)`);
        process.exit(1);
      }
    } else {
      const hexKey = await resolveKey(projectDir);
      const data = readFileSync(encFile);
      const plaintext = decodeEncrypted(data, hexKey);
      ({ env } = parse(plaintext));
    }

    if (!(key in env)) {
      console.error(`error: key '${key}' not found`);
      process.exit(1);
    }

    // Output raw value (no trailing newline for piping)
    process.stdout.write(env[key]);
  });
