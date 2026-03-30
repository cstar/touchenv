import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodeEncrypted } from '../format.js';
import { resolveKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';

export const decryptCommand = new Command('decrypt')
  .description('Decrypt .env.encrypted to stdout')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (opts: { dir: string }) => {
    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    if (!existsSync(encFile)) {
      console.error(`error: ${ENCRYPTED_FILE} not found (run 'touchenv init' first)`);
      process.exit(1);
    }

    const hexKey = await resolveKey(projectDir);
    const data = readFileSync(encFile);
    const plaintext = decodeEncrypted(data, hexKey);

    process.stdout.write(plaintext);
  });
