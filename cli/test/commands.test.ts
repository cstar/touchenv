import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { encodeEncrypted, decodeEncrypted } from '../src/format.js';
import { generateKey } from '../src/crypto.js';
import { parse, serialize } from '../src/parser.js';

const CLI_PATH = join(import.meta.dirname, '..', 'src', 'cli.ts');
const TSX = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsx');

function run(args: string[], env?: Record<string, string>): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(TSX, [CLI_PATH, ...args], {
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      timeout: 10000,
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      status: err.status ?? 1,
    };
  }
}

describe('CLI commands', () => {
  let tmpDir: string;
  let hexKey: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'touchenv-test-'));
    hexKey = generateKey().toString('hex');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('set', () => {
    it('should set a variable in an existing encrypted file', () => {
      // Create initial encrypted file with one var
      const initial = encodeEncrypted('EXISTING=hello\n', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['set', 'NEW_VAR', 'world', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /NEW_VAR set/);

      // Verify the var was added
      const data = readFileSync(join(tmpDir, '.env.encrypted'));
      const plaintext = decodeEncrypted(data, hexKey);
      const { env } = parse(plaintext);
      assert.equal(env['EXISTING'], 'hello');
      assert.equal(env['NEW_VAR'], 'world');
    });

    it('should overwrite an existing variable', () => {
      const initial = encodeEncrypted('FOO=old\n', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['set', 'FOO', 'new', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 0);

      const data = readFileSync(join(tmpDir, '.env.encrypted'));
      const plaintext = decodeEncrypted(data, hexKey);
      const { env } = parse(plaintext);
      assert.equal(env['FOO'], 'new');
    });

    it('should reject invalid key names', () => {
      const initial = encodeEncrypted('', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['set', '123BAD', 'val', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /invalid key/);
    });

    it('should fail if no encrypted file exists', () => {
      const result = run(['set', 'KEY', 'val', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /not found/);
    });
  });

  describe('get', () => {
    it('should retrieve a variable value', () => {
      const initial = encodeEncrypted('SECRET=hunter2\n', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['get', 'SECRET', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 0);
      assert.equal(result.stdout, 'hunter2');
    });

    it('should fail for missing key', () => {
      const initial = encodeEncrypted('A=1\n', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['get', 'MISSING', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /not found/);
    });
  });

  describe('list', () => {
    it('should list all keys', () => {
      const initial = encodeEncrypted('A=1\nB=2\nC=3\n', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['list', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /A/);
      assert.match(result.stdout, /B/);
      assert.match(result.stdout, /C/);
    });

    it('should list keys with values when -v is used', () => {
      const initial = encodeEncrypted('FOO=bar\nBAZ=qux\n', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['list', '-v', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /FOO=bar/);
      assert.match(result.stdout, /BAZ=qux/);
    });

    it('should show message for empty file', () => {
      const initial = encodeEncrypted('', hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['list', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 0);
      assert.match(result.stdout, /no variables/);
    });
  });

  describe('decrypt', () => {
    it('should output decrypted content to stdout', () => {
      const content = 'DB_HOST=localhost\nDB_PORT=5432\n';
      const initial = encodeEncrypted(content, hexKey);
      writeFileSync(join(tmpDir, '.env.encrypted'), initial);

      const result = run(['decrypt', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 0);
      assert.equal(result.stdout, content);
    });

    it('should fail if no encrypted file exists', () => {
      const result = run(['decrypt', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /not found/);
    });
  });

  describe('init (with TOUCHENV_KEY — no keychain)', () => {
    // Note: init with keychain requires the touchenv-keychain binary and biometrics.
    // We test the file creation path by pre-setting TOUCHENV_KEY and using set after init.

    it('should fail if .env.encrypted already exists without --force', () => {
      writeFileSync(join(tmpDir, '.env.encrypted'), Buffer.alloc(35));

      // init requires keychain (no TOUCHENV_KEY bypass for init), so we test the guard
      const result = run(['init', '-d', tmpDir], { TOUCHENV_KEY: hexKey });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /already exists/);
    });
  });

  describe('version and help', () => {
    it('should show version', () => {
      const result = run(['--version']);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /0\.1\.0/);
    });

    it('should show help', () => {
      const result = run(['--help']);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /init/);
      assert.match(result.stdout, /edit/);
      assert.match(result.stdout, /set/);
      assert.match(result.stdout, /get/);
      assert.match(result.stdout, /list/);
      assert.match(result.stdout, /decrypt/);
    });
  });
});
