import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, serialize } from '../src/parser.js';

const vectorsPath = join(import.meta.dirname, '..', '..', 'spec', 'test-vectors', 'all-vectors.json');
const vectors = JSON.parse(readFileSync(vectorsPath, 'utf-8')).vectors;

describe('parse — basic rules', () => {
  it('parses simple KEY=VALUE', () => {
    const { env } = parse('FOO=bar\n');
    assert.equal(env.FOO, 'bar');
  });

  it('handles empty value', () => {
    const { env } = parse('EMPTY=\n');
    assert.equal(env.EMPTY, '');
  });

  it('skips comment lines', () => {
    const { env } = parse('# comment\nKEY=val\n');
    assert.deepEqual(Object.keys(env), ['KEY']);
  });

  it('skips empty lines', () => {
    const { env } = parse('\n\nKEY=val\n\n');
    assert.equal(env.KEY, 'val');
    assert.equal(Object.keys(env).length, 1);
  });

  it('strips "export " prefix', () => {
    const { env } = parse('export MY_VAR=hello\n');
    assert.equal(env.MY_VAR, 'hello');
  });

  it('last value wins for duplicate keys', () => {
    const { env } = parse('DUP=first\nDUP=second\n');
    assert.equal(env.DUP, 'second');
  });
});

describe('parse — quoting', () => {
  it('double-quoted value with spaces', () => {
    const { env } = parse('Q="hello world"\n');
    assert.equal(env.Q, 'hello world');
  });

  it('double-quoted escape sequences', () => {
    const { env } = parse('ESC="line1\\nline2\\ttab\\\\slash\\"quote"\n');
    assert.equal(env.ESC, 'line1\nline2\ttab\\slash"quote');
  });

  it('single-quoted value is literal', () => {
    const { env } = parse("LIT='no \\n expansion $HOME'\n");
    assert.equal(env.LIT, 'no \\n expansion $HOME');
  });

  it('unquoted value is trimmed', () => {
    const { env } = parse('TRIMMED=  spaces around\n');
    assert.equal(env.TRIMMED, 'spaces around');
  });
});

describe('parse — key validation', () => {
  it('accepts valid keys', () => {
    const { env } = parse('_PRIVATE=1\nABC_123=2\nX=3\n');
    assert.equal(env._PRIVATE, '1');
    assert.equal(env.ABC_123, '2');
    assert.equal(env.X, '3');
  });

  it('skips keys starting with number', () => {
    const { env } = parse('123=bad\nGOOD=ok\n');
    assert.equal(Object.keys(env).length, 1);
    assert.equal(env.GOOD, 'ok');
  });
});

describe('test vectors — parser', () => {
  for (const vector of vectors) {
    it(`parses "${vector.name}" plaintext to expected env`, () => {
      const { env } = parse(vector.plaintext);
      assert.deepEqual(env, vector.env);
    });
  }
});

describe('serialize', () => {
  it('serializes simple values', () => {
    const result = serialize({ FOO: 'bar', BAZ: 'qux' });
    assert.equal(result, 'FOO=bar\nBAZ=qux\n');
  });

  it('quotes values with special characters', () => {
    const result = serialize({ MULTI: 'line1\nline2' });
    assert.equal(result, 'MULTI="line1\\nline2"\n');
  });

  it('quotes values with spaces', () => {
    const result = serialize({ MSG: 'hello world' });
    assert.equal(result, 'MSG="hello world"\n');
  });

  it('escapes backslashes and quotes', () => {
    const result = serialize({ V: 'a\\b"c' });
    assert.equal(result, 'V="a\\\\b\\"c"\n');
  });

  it('round-trips through parse', () => {
    const original = { KEY: 'value', MULTI: 'a\nb', QUOTED: 'has "quotes"' };
    const serialized = serialize(original);
    const { env } = parse(serialized);
    assert.deepEqual(env, original);
  });
});
