import { existsSync, readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Command } from 'commander';
import { decodeEncrypted, encodeEncrypted } from '../format.js';
import { resolveKey } from '../keychain.js';

const ENCRYPTED_FILE = '.env.encrypted';

function getEditor(): string {
  return process.env['VISUAL'] || process.env['EDITOR'] || 'vi';
}

function getTmpDir(): string {
  // Prefer tmpfs/ramfs mounts for security (in-memory, not written to disk)
  // macOS: /dev/shm doesn't exist, but /tmp is on APFS which is encrypted at rest
  // Linux: /dev/shm is a tmpfs mount
  if (existsSync('/dev/shm')) {
    return '/dev/shm';
  }
  // Fall back to system tmp (macOS APFS volumes are encrypted at rest)
  return process.env['TMPDIR'] || '/tmp';
}

export const editCommand = new Command('edit')
  .description('Decrypt to a temp file, open in $EDITOR, re-encrypt on save')
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

    // Create temp file in secure location
    const tmpDir = mkdtempSync(join(getTmpDir(), 'touchenv-'));
    const tmpFile = join(tmpDir, '.env');

    try {
      writeFileSync(tmpFile, plaintext, { mode: 0o600 });

      const editor = getEditor();
      execFileSync(editor, [tmpFile], { stdio: 'inherit' });

      const edited = readFileSync(tmpFile, 'utf-8');

      // Only re-encrypt if content changed
      if (edited !== plaintext) {
        const newData = encodeEncrypted(edited, hexKey);
        writeFileSync(encFile, newData);
        console.log(`${ENCRYPTED_FILE} updated`);
      } else {
        console.log('No changes');
      }
    } finally {
      // Securely clean up temp file
      try {
        unlinkSync(tmpFile);
        rmdirSync(tmpDir);
      } catch {
        // Best effort cleanup
      }
    }
  });
