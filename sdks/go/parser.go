package touchenv

import (
	"regexp"
	"strings"
)

var keyPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// parse parses a dotenv-formatted string into key-value pairs.
// Follows the rules in FORMAT.md:
//   - Lines starting with # are comments (skipped)
//   - Empty lines are skipped
//   - KEY=VALUE format
//   - Unquoted values: trimmed
//   - Double-quoted: \n, \t, \\, \" escapes expanded
//   - Single-quoted: literal (no escapes)
//   - "export " prefix stripped
//   - Duplicate keys: last wins
//   - Keys: [A-Za-z_][A-Za-z0-9_]*
func parse(input string) map[string]string {
	env := make(map[string]string)
	lines := strings.Split(input, "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// Strip optional "export " prefix
		effective := trimmed
		if strings.HasPrefix(effective, "export ") {
			effective = effective[7:]
		}

		// Find the = separator
		eqIdx := strings.Index(effective, "=")
		if eqIdx == -1 {
			continue
		}

		key := effective[:eqIdx]
		if !keyPattern.MatchString(key) {
			continue
		}

		rawValue := effective[eqIdx+1:]
		env[key] = parseValue(rawValue)
	}

	return env
}

func parseValue(raw string) string {
	if len(raw) >= 2 && raw[0] == '"' && raw[len(raw)-1] == '"' {
		return expandEscapes(raw[1 : len(raw)-1])
	}

	if len(raw) >= 2 && raw[0] == '\'' && raw[len(raw)-1] == '\'' {
		return raw[1 : len(raw)-1]
	}

	return strings.TrimSpace(raw)
}

func expandEscapes(s string) string {
	var b strings.Builder
	b.Grow(len(s))

	for i := 0; i < len(s); i++ {
		if s[i] == '\\' && i+1 < len(s) {
			next := s[i+1]
			switch next {
			case 'n':
				b.WriteByte('\n')
			case 't':
				b.WriteByte('\t')
			case '\\':
				b.WriteByte('\\')
			case '"':
				b.WriteByte('"')
			default:
				b.WriteByte('\\')
				b.WriteByte(next)
			}
			i++
		} else {
			b.WriteByte(s[i])
		}
	}

	return b.String()
}
