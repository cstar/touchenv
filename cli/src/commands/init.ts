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

    const hexKey = await generateAndStoreKey(projectDir);

    // Create empty encrypted file (empty .env content)
    const data = encodeEncrypted('', hexKey);
    writeFileSync(encFile, data);

    console.log(`Initialized touchenv in ${projectDir}`);
    console.log(`  DEK stored in macOS Keychain (account: ${projectDir})`);
    console.log(`  Created ${ENCRYPTED_FILE}`);
  });
