import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { decodeEncrypted, encodeEncrypted } from '../format.js';
import { parse, serialize } from '../parser.js';
import { resolveKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';

export const setCommand = new Command('set')
  .description('Set an environment variable in .env.encrypted')
  .argument('<key>', 'Variable name')
  .argument('<value>', 'Variable value')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (key: string, value: string, opts: { dir: string }) => {
    const projectDir = resolve(opts.dir);
    const encFile = resolve(projectDir, ENCRYPTED_FILE);

    if (!existsSync(encFile)) {
      console.error(`error: ${ENCRYPTED_FILE} not found (run 'touchenv init' first)`);
      process.exit(1);
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      console.error(`error: invalid key '${key}' (must match [A-Za-z_][A-Za-z0-9_]*)`);
      process.exit(1);
    }

    const hexKey = await resolveKey(projectDir);
    const data = readFileSync(encFile);
    const plaintext = decodeEncrypted(data, hexKey);
    const { env } = parse(plaintext);

    env[key] = value;

    const newPlaintext = serialize(env);
    const newData = encodeEncrypted(newPlaintext, hexKey);
    writeFileSync(encFile, newData);

    console.log(`${key} set`);
  });
