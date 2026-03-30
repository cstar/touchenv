export interface ParseResult {
  /** Parsed key-value pairs (last-wins for duplicates) */
  env: Record<string, string>;
  /** Original lines preserved for round-trip fidelity */
  lines: string[];
}

/**
 * Parse a dotenv-formatted string into key-value pairs.
 *
 * Rules (per FORMAT.md):
 * 1. Lines starting with # are comments (preserved)
 * 2. Empty lines are preserved
 * 3. KEY=VALUE — no spaces required around =
 * 4. Unquoted values: trimmed, read until EOL
 * 5. Double-quoted: \n, \t, \\, \" escape sequences expanded
 * 6. Single-quoted: literal (no escape processing)
 * 7. "export " prefix is optional and stripped
 * 8. Duplicate keys: last value wins
 * 9. Keys: [A-Za-z_][A-Za-z0-9_]*
 */
export function parse(input: string): ParseResult {
  const env: Record<string, string> = {};
  const lines = input.split('\n');

  // If input ends with \n, split produces trailing empty string — preserve it
  // but don't process it as a line to parse
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // Strip optional "export " prefix
    const effective = trimmed.startsWith('export ')
      ? trimmed.slice(7)
      : trimmed;

    // Find the = separator
    const eqIdx = effective.indexOf('=');
    if (eqIdx === -1) {
      continue; // Malformed line — skip
    }

    const key = effective.slice(0, eqIdx);

    // Validate key format
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue; // Invalid key — skip
    }

    const rawValue = effective.slice(eqIdx + 1);
    env[key] = parseValue(rawValue);
  }

  return { env, lines };
}

/**
 * Parse a value from a dotenv line (after the =).
 */
function parseValue(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    // Double-quoted: process escape sequences
    return expandEscapes(raw.slice(1, -1));
  }

  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
    // Single-quoted: literal, no escapes
    return raw.slice(1, -1);
  }

  // Unquoted: trim whitespace, strip inline comments
  return raw.trim();
}

/**
 * Expand escape sequences in double-quoted values.
 */
function expandEscapes(s: string): string {
  let result = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const next = s[i + 1];
      switch (next) {
        case 'n':
          result += '\n';
          break;
        case 't':
          result += '\t';
          break;
        case '\\':
          result += '\\';
          break;
        case '"':
          result += '"';
          break;
        default:
          // Unknown escape — keep as-is
          result += '\\' + next;
          break;
      }
      i += 2;
    } else {
      result += s[i];
      i++;
    }
  }
  return result;
}

/**
 * Serialize env key-value pairs back to dotenv format.
 * Values containing special characters are double-quoted with escapes.
 */
export function serialize(env: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (needsQuoting(value)) {
      lines.push(`${key}="${escapeValue(value)}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  return lines.join('\n') + '\n';
}

function needsQuoting(value: string): boolean {
  return (
    value.includes('\n') ||
    value.includes('\t') ||
    value.includes('"') ||
    value.includes('\\') ||
    value !== value.trim() ||
    value.includes(' ')
  );
}

function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}
