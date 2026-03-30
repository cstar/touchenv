import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodeEncrypted } from '../format.js';
import { parse } from '../parser.js';
import { resolveKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';

export const listCommand = new Command('list')
  .description('List all keys in .env.encrypted')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('-v, --values', 'Show values alongside keys')
  .action(async (opts: { dir: string; values: boolean }) => {
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

    const keys = Object.keys(env);
    if (keys.length === 0) {
      console.log('(no variables)');
      return;
    }

    for (const key of keys) {
      if (opts.values) {
        console.log(`${key}=${env[key]}`);
      } else {
        console.log(key);
      }
    }
  });
