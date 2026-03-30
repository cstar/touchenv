import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/parser.js';

describe('parse', () => {
  it('parses simple key=value', () => {
    assert.deepEqual(parse('FOO=bar'), { FOO: 'bar' });
  });

  it('handles comments and blank lines', () => {
    const input = '# comment\n\nFOO=bar\n';
    assert.deepEqual(parse(input), { FOO: 'bar' });
  });

  it('handles double-quoted values with escapes', () => {
    assert.deepEqual(parse('FOO="hello\\nworld"'), { FOO: 'hello\nworld' });
    assert.deepEqual(parse('FOO="tab\\there"'), { FOO: 'tab\there' });
    assert.deepEqual(parse('FOO="back\\\\slash"'), { FOO: 'back\\slash' });
    assert.deepEqual(parse('FOO="escaped\\"quote"'), { FOO: 'escaped"quote' });
  });

  it('handles single-quoted values (literal)', () => {
    assert.deepEqual(parse("FOO='hello\\nworld'"), { FOO: 'hello\\nworld' });
  });

  it('handles export prefix', () => {
    assert.deepEqual(parse('export FOO=bar'), { FOO: 'bar' });
  });

  it('last value wins for duplicates', () => {
    assert.deepEqual(parse('FOO=first\nFOO=second'), { FOO: 'second' });
  });

  it('trims unquoted values', () => {
    assert.deepEqual(parse('FOO=  bar  '), { FOO: 'bar' });
  });

  it('handles empty value', () => {
    assert.deepEqual(parse('FOO='), { FOO: '' });
  });

  it('skips invalid key names', () => {
    assert.deepEqual(parse('123BAD=value\nGOOD=value'), { GOOD: 'value' });
  });

  it('skips lines without =', () => {
    assert.deepEqual(parse('noequals\nFOO=bar'), { FOO: 'bar' });
  });
});
