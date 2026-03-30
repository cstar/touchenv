import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodeEncrypted, encodePortable } from '../format.js';
import { resolveKey } from '../keychain.js';
import { promptPasswordWithConfirm } from '../prompt.js';

const ENCRYPTED_FILE = '.env.encrypted';
const PORTABLE_FILE = '.env.portable';

export const exportCommand = new Command('export')
  .description('Export .env.encrypted as a password-protected portable file')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('-o, --output <path>', 'Output file path')
  .action(async (opts: { dir: string; output?: string }) => {
    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    if (!existsSync(encFile)) {
      console.error(`error: ${ENCRYPTED_FILE} not found (run 'touchenv init' first)`);
      process.exit(1);
    }

    // Decrypt with the local DEK
    const hexKey = await resolveKey(projectDir);
    const data = readFileSync(encFile);
    const plaintext = decodeEncrypted(data, hexKey);

    // Encrypt with a password
    const password = await promptPasswordWithConfirm();
    const portable = encodePortable(plaintext, password);

    const outPath = opts.output
      ? resolve(opts.output)
      : resolve(projectDir, PORTABLE_FILE);

    writeFileSync(outPath, portable);
    console.log(`Exported to ${outPath}`);
    console.log('Share this file and the password with your teammate.');
  });
