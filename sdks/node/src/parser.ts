export function parse(input: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = input.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const effective = trimmed.startsWith('export ')
      ? trimmed.slice(7)
      : trimmed;

    const eqIdx = effective.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }

    const key = effective.slice(0, eqIdx);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    const rawValue = effective.slice(eqIdx + 1);
    env[key] = parseValue(rawValue);
  }

  return env;
}

function parseValue(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return expandEscapes(raw.slice(1, -1));
  }

  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
    return raw.slice(1, -1);
  }

  return raw.trim();
}

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
