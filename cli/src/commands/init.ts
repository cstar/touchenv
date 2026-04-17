import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { encodeEncrypted } from '../format.js';
import { generateAndStoreKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';

export const initCommand = new Command('init')
  .description('Initialize touchenv: generate DEK, store in Keychain, create .env.encrypted')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('-f, --force', 'Overwrite existing .env.encrypted')
  .action(async (opts: { dir: string; force: boolean }) => {
    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    if (existsSync(encFile) && !opts.force) {
      console.error(`error: ${ENCRYPTED_FILE} already exists (use --force to overwrite)`);
      process.exit(1);
    }

    const envKey = process.env['TOUCHENV_KEY'];
    let hexKey: string;
    let storedIn: string;

    if (envKey) {
      if (!/^[0-9a-fA-F]{64}$/.test(envKey)) {
        console.error('error: TOUCHENV_KEY must be exactly 64 hex characters (256 bits)');
        process.exit(1);
      }
      hexKey = envKey.toLowerCase();
      storedIn = 'TOUCHENV_KEY env var (not stored in Keychain)';
    } else {
      hexKey = await generateAndStoreKey(projectDir);
      storedIn = `macOS Keychain (account: ${projectDir})`;
    }

    const data = encodeEncrypted('', hexKey);
    writeFileSync(encFile, data);

    console.log(`Initialized touchenv in ${projectDir}`);
    console.log(`  DEK: ${storedIn}`);
    console.log(`  Created ${ENCRYPTED_FILE}`);
  });
