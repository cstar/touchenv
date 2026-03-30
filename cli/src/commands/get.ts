import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodeEncrypted } from '../format.js';
import { parse } from '../parser.js';
import { resolveKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';

export const getCommand = new Command('get')
  .description('Get an environment variable from .env.encrypted')
  .argument('<key>', 'Variable name')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (key: string, opts: { dir: string }) => {
    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    if (!existsSync(encFile)) {
      console.error(`error: ${ENCRYPTED_FILE} not found (run 'touchenv init' first)`);
      process.exit(1);
    }

    const hexKey = await resolveKey(projectDir);
    const data = readFileSync(encFile);
    const plaintext = decodeEncrypted(data, hexKey);
    const { env } = parse(plaintext);

    if (!(key in env)) {
      console.error(`error: key '${key}' not found`);
      process.exit(1);
    }

    // Output raw value (no trailing newline for piping)
    process.stdout.write(env[key]);
  });
