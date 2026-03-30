import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodePortable, encodeEncrypted } from '../format.js';
import { resolveKey } from '../keychain.js';
import { promptPassword } from '../prompt.js';

const ENCRYPTED_FILE = '.env.encrypted';

export const importCommand = new Command('import')
  .description('Import a password-protected portable file into .env.encrypted')
  .argument('<file>', 'Path to the .env.portable file')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('-f, --force', 'Overwrite existing .env.encrypted')
  .option('--stdout', 'Decrypt to stdout instead of writing .env.encrypted')
  .action(async (file: string, opts: { dir: string; force: boolean; stdout: boolean }) => {
    const portablePath = resolve(file);
    if (!existsSync(portablePath)) {
      console.error(`error: file not found: ${portablePath}`);
      process.exit(1);
    }

    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    if (!opts.stdout && existsSync(encFile) && !opts.force) {
      console.error(`error: ${ENCRYPTED_FILE} already exists (use --force to overwrite)`);
      process.exit(1);
    }

    // Read and decrypt the portable file
    const data = readFileSync(portablePath);
    const password = await promptPassword('Password: ');
    const plaintext = decodePortable(data, password);

    if (opts.stdout) {
      process.stdout.write(plaintext);
      return;
    }

    // Re-encrypt with the local DEK
    const hexKey = await resolveKey(projectDir);
    const encrypted = encodeEncrypted(plaintext, hexKey);

    writeFileSync(encFile, encrypted);
    console.log(`Imported ${portablePath} into ${encFile}`);
  });
