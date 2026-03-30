"""Dotenv-compatible parser following FORMAT.md parsing rules."""

from __future__ import annotations

import re

_KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def parse(input_text: str) -> dict[str, str]:
    """Parse a dotenv-formatted string into key-value pairs.

    Rules (per FORMAT.md):
    1. Lines starting with # are comments
    2. Empty lines are skipped
    3. KEY=VALUE
    4. Unquoted values: trimmed, read until EOL
    5. Double-quoted: \\n, \\t, \\\\, \\" escape sequences expanded
    6. Single-quoted: literal (no escape processing)
    7. "export " prefix is optional and stripped
    8. Duplicate keys: last value wins
    9. Keys: [A-Za-z_][A-Za-z0-9_]*
    """
    env: dict[str, str] = {}

    for line in input_text.split("\n"):
        trimmed = line.strip()

        if trimmed == "" or trimmed.startswith("#"):
            continue

        # Strip optional "export " prefix
        effective = trimmed[7:] if trimmed.startswith("export ") else trimmed

        eq_idx = effective.find("=")
        if eq_idx == -1:
            continue

        key = effective[:eq_idx]
        if not _KEY_PATTERN.match(key):
            continue

        raw_value = effective[eq_idx + 1 :]
        env[key] = _parse_value(raw_value)

    return env


def _parse_value(raw: str) -> str:
    if raw.startswith('"') and raw.endswith('"') and len(raw) >= 2:
        return _expand_escapes(raw[1:-1])

    if raw.startswith("'") and raw.endswith("'") and len(raw) >= 2:
        return raw[1:-1]

    # Unquoted: trim whitespace
    return raw.strip()


def _expand_escapes(s: str) -> str:
    result: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            nxt = s[i + 1]
            if nxt == "n":
                result.append("\n")
            elif nxt == "t":
                result.append("\t")
            elif nxt == "\\":
                result.append("\\")
            elif nxt == '"':
                result.append('"')
            else:
                result.append("\\" + nxt)
            i += 2
        else:
            result.append(s[i])
            i += 1
    return "".join(result)
